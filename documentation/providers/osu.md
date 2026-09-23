## osu!

OAuth 2.0 provider for osu!

Also see the [OAuth 2.0](/low-level-api#without-pkce) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const osu = new arctic.Osu(clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["public", "friends.read"];
const url = osu.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). osu! returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await osu.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
	const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
	const refreshToken = tokens.refreshToken();
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

### Refresh access tokens

Use `refreshAccessToken()` to get a new access token using a refresh token. osu! returns the same values as during the authorization code validation. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	const tokens = await osu.refreshAccessToken(refreshToken);
	const accessToken = tokens.accessToken();
	const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
	const refreshToken = tokens.refreshToken();
} catch (e) {
	if (e instanceof arctic.OAuth2RequestError) {
		// Invalid authorization code, credentials, or redirect URI
	}
	if (e instanceof arctic.ArcticFetchError) {
		// Failed to call `fetch()`
	}
	// Parse error
}
```

### Get user profile

Use the [`/me` endpoint](https://osu.ppy.sh/docs/index.html#get-own-data).

```ts
const response = await fetch("https://osu.ppy.sh/api/v2/me", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
