## Gitea

OAuth 2.0 provider for Gitea.

Also see [OAuth 2.0 with PKCE](/low-level-api#with-pkce).

### Initialization

The `baseURL` parameter is the full URL where the Gitea instance is hosted. Use `https://gitea.com` for managed servers. Pass the client secret for confidential clients.

```ts
import * as arctic from "antarctic";

const baseURL = "https://gitea.com";
const baseURL = "https://my-app.com/gitea";
const gitea = new arctic.Gitea(baseURL, clientId, clientSecret, redirectURI);
const gitea = new arctic.Gitea(baseURL, clientId, null, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["read:user", "write:notification"];
const url = await gitea.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). Gitea returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await gitea.validateAuthorizationCode(code, codeVerifier);
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

Use `refreshAccessToken()` to get a new access token using a refresh token. This method's behavior is identical to `validateAuthorizationCode()`.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await gitea.refreshAccessToken(refreshToken);
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

Add the `read:user` scope and use the [`/user` endpoint](https://gitea.com/api/swagger#/user).

```ts
const scopes = ["read:user"];
const url = await gitea.createAuthorizationURL(state, codeVerifier, scopes);
```

```ts
const response = await fetch("https://gitea.com/api/v1/user", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
