# Low-level API

Arctic's API is available on the same classes, for when you want to drive each step of the flow yourself. Build the provider with the positional constructor, generate the state and PKCE verifier, keep them in cookies, and exchange the code for tokens.

```ts
import * as arctic from "antarctic";

const github = new arctic.GitHub(clientId, clientSecret, redirectURI);
```

Both constructors build the same class, so you can mix the two APIs, but `getAuthorizationURL()` and `getUser()` throw `OAuthConfigurationError` on an instance built with the positional constructor. The API is nearly identical across providers, so check each provider's page for its constructor and whether it uses PKCE.

If this is your first time working with OAuth, consider reading one of these articles:

- [OAuth](https://thecopenhagenbook.com/oauth) (The Copenhagen Book)
- [A beginner's guide to OAuth 2.0](https://pilcrowonpaper.com/blog/oauth-guide/) (by Pilcrow)

## Without PKCE

### Create authorization URL

Generate a state with `generateState()` and store it in a cookie. Use it to create an authorization URL with `createAuthorizationURL()`, and redirect the user to it.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["user:email", "repo"];
const url = github.createAuthorizationURL(state, scopes);

setCookie("state", state, {
	secure: true, // set to false in localhost
	path: "/",
	httpOnly: true,
	maxAge: 60 * 10 // 10 min
});

return redirect(url);
```

### Validate authorization code

Compare the state, then use `validateAuthorizationCode()` to exchange the code. It returns an [`OAuth2Tokens`](/reference#oauth2tokens), or throws one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror).

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

## With PKCE

Providers that use PKCE also need a code verifier, kept alongside the state. Their `createAuthorizationURL()` returns a promise, since it hashes the verifier with the platform's asynchronous SHA-256.

```ts
import * as arctic from "antarctic";

const google = new arctic.Google(clientId, clientSecret, redirectURI);
```

### Create authorization URL

Generate a state and a code verifier with `generateState()` and `generateCodeVerifier()`, store both in cookies, and redirect the user to the authorization URL.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile", "email"];
const url = await google.createAuthorizationURL(state, codeVerifier, scopes);

setCookie("state", state, {
	secure: true, // set to false in localhost
	path: "/",
	httpOnly: true,
	maxAge: 60 * 10 // 10 min
});
setCookie("code_verifier", codeVerifier, {
	secure: true, // set to false in localhost
	path: "/",
	httpOnly: true,
	maxAge: 60 * 10 // 10 min
});

return redirect(url);
```

### Validate authorization code

Compare the state, then pass the code and the code verifier to `validateAuthorizationCode()`. It returns and throws the same as [without PKCE](#without-pkce).

```ts
import * as arctic from "antarctic";

const code = request.url.searchParams.get("code");
const state = request.url.searchParams.get("state");
const storedState = getCookie("state");
const storedCodeVerifier = getCookie("code_verifier");

if (code === null || storedState === null || state !== storedState || storedCodeVerifier === null) {
	// 400
	throw new Error("Invalid request");
}

try {
	const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
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

## Tokens

`OAuth2Tokens` parses the token response lazily. `accessToken()`, for example, returns the `access_token` field and throws a parse `Error` if the provider did not send it. Each provider's page lists what it returns.

```ts
const accessToken = tokens.accessToken();
const accessTokenExpiresInSeconds = tokens.accessTokenExpiresInSeconds();
const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
const refreshToken = tokens.refreshToken();
const idToken = tokens.idToken();
```

Use [`decodeIdToken()`](/reference#decodeidtoken) to read the ID token's claims. It does not verify the signature.

```ts
const claims = arctic.decodeIdToken(idToken);
```

## Generic client

`OAuth2Client` covers providers that are not in the list, following [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749), [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009), and [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636). It follows them strictly, so it may not work with providers that:

- Do not support HTTP Basic authentication for the client credentials.
- Return errors with a status other than 400.
- Return a custom JSON error body.

Only client password authentication is supported.

### Initialization

Pass your client ID, client password (secret), and redirect URI. The password and redirect URI can be `null`.

```ts
import * as arctic from "antarctic";

const client = new arctic.OAuth2Client(clientId, clientPassword, redirectURI);
```

### Create authorization URL

Pass the provider's authorization endpoint to `createAuthorizationURL()`.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const url = client.createAuthorizationURL(authorizationEndpoint, state, scopes);
```

For PKCE, use `createAuthorizationURLWithPKCE()`, which returns a promise.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const url = await client.createAuthorizationURLWithPKCE(
	authorizationEndpoint,
	state,
	arctic.CodeChallengeMethod.S256,
	codeVerifier,
	scopes
);
```

### Validate authorization code

Pass the token endpoint and the code to `validateAuthorizationCode()`, with `null` as the code verifier when not using PKCE. It returns and throws the same as the provider classes.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await client.validateAuthorizationCode(tokenEndpoint, code, null);
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

With PKCE, pass the code verifier instead:

```ts
const tokens = await client.validateAuthorizationCode(tokenEndpoint, code, codeVerifier);
```

### Refresh access token

`refreshAccessToken()` returns a new `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`. Pass an empty `scopes` array to keep the same scopes.

```ts
const tokens = await client.refreshAccessToken(tokenEndpoint, refreshToken, scopes);
```

### Revoke token

`revokeToken()` throws the same errors as `validateAuthorizationCode()`.

```ts
await client.revokeToken(tokenRevocationEndpoint, token);
```
