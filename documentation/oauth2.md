# OAuth 2.0

Most providers require a client ID, client secret, and redirect URI. The API is nearly identical across providers but always check each provider's guide before implementing.

```ts
import * as arctic from "antarctic";

const github = new arctic.GitHub(clientId, clientSecret, redirectURI);
```

If this is your first time working with OAuth, consider reading one of these articles:

- [OAuth](https://thecopenhagenbook.com/oauth) (The Copenhagen Book)
- [A beginner's guide to OAuth 2.0](https://pilcrowonpaper.com/blog/oauth-guide/) (by Pilcrow)

## Create authorization URL

Generate state using `generateState()` and store it as a cookie. Use it to create an authorization URL with `createAuthorizationURL()` and redirect the user to it.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();

const scopes = ["user:email", "repo"];
const url = github.createAuthorizationURL(state, scopes);

// store state as cookie
setCookie("state", state, {
	secure: true, // set to false in localhost
	path: "/",
	httpOnly: true,
	maxAge: 60 * 10 // 10 min
});

return redirect(url);
```

## Validate authorization code

Compare the state, and use `validateAuthorizationCode()` to validate the authorization code. This returns an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror)..

```ts
import * as arctic from "antarctic";

const code = request.url.searchParams.get("code");
const state = request.url.searchParams.get("state");

const storedState = getCookie("state");

if (code === null || storedState === null || state !== storedState) {
	// 400
	throw new Error("Invalid request");
}

try {
	const tokens = await github.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
} catch (e) {
	if (e instanceof arctic.OAuth2RequestError) {
		// Invalid authorization code, credentials, or redirect URI
		const code = e.code;
		// ...
	}
	if (e instanceof arctic.ArcticFetchError) {
		// Failed to call `fetch()`
		const cause = e.cause;
		// ...
	}
	// Parse error
}
```

Calling `OAuth2Tokens.accessToken()` for example parses the response and returns the `access_token` field. If it doesn't exist, it will throw a parse `Error`. See each provider's guides for the actual return values.

```ts
const accessToken = tokens.accessToken();
const accessTokenExpiresInSeconds = tokens.accessTokenExpiresInSeconds();
const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
const refreshToken = tokens.refreshToken();
const idToken = tokens.idToken();
```

Antarctic provides [`decodeIdToken()`](/documentation/reference#decodeidtoken) for decoding the token's payload.

```ts
const claims = arctic.decodeIdToken(idToken);
```
