## Okta

OAuth 2.0 provider for Okta.

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

The `domain` parameter should not include the protocol or path. The `authorizationServerId` parameter is optional.

```ts
import * as arctic from "antarctic";

const domain = "auth.example.com";

const okta = new arctic.Okta(domain, null, clientId, clientSecret, redirectURI);
const okta = new arctic.Okta(domain, authorizationServerId, clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile"];
const url = await okta.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Actual values returned by Okta depends on your configuration.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await okta.validateAuthorizationCode(code, codeVerifier);
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

Use `refreshAccessToken()` to get a new access token using a refresh token. Okta requires you to pass scopes when refreshing tokens. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	// Pass an empty `scopes` array to keep using the same scopes.
	const tokens = await okta.refreshAccessToken(refreshToken, scopes);
	const accessToken = tokens.accessToken();
	const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
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
	await okta.revokeToken(token);
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
