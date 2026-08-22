## Authentik

OAuth 2.0 provider for Authentik.

Also see the [OAuth 2.0 with PKCE](/documentation/oauth2-with-pkce) guide.

### Initialization

The `baseURL` parameter is the full URL where the Authentik instance is hosted. Pass the client secret for confidential clients.

```ts
import * as arctic from "antarctic";

const baseURL = "https://my-app.com/authentik";
const authentik = new arctic.Authentik(baseURL, clientId, clientSecret, redirectURI);
const authentik = new arctic.Authentik(baseURL, clientId, null, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile"];
const url = await authentik.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Actual values returned by Authentik depends on your configuration and version.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await authentik.validateAuthorizationCode(code, codeVerifier);
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

### OpenID Connect

Use OpenID Connect with the `openid` scope to get the user's profile with an ID token or the `userinfo` endpoint. Antarctic provides [`decodeIdToken()`](/documentation/reference#decodeidtoken) for decoding the token's payload.

```ts
const scopes = ["openid"];
const url = await authentik.createAuthorizationURL(state, codeVerifier, scopes);
```

```ts
import * as arctic from "antarctic";

const tokens = await authentik.validateAuthorizationCode(code, codeVerifier);
const idToken = tokens.idToken();
const claims = arctic.decodeIdToken(idToken);
```

### Refresh access tokens

Use `refreshAccessToken()` to get a new access token using a refresh token. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await authentik.refreshAccessToken(refreshToken);
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

### Revoke tokens

Use `revokeToken()` to revoke a token. This can throw the same errors as `validateAuthorizationCode()`.

```ts
try {
	await authentik.revokeToken(token);
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
