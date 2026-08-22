## Spotify

OAuth 2.0 provider for Spotify.

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

Pass the client secret for confidential clients.

```ts
import * as arctic from "antarctic";

const spotify = new arctic.Spotify(clientId, clientSecret, redirectURI);
const spotify = new arctic.Spotify(clientId, null, redirectURI);
```

### Create authorization URL

For confidential clients, pass the state and scopes. **PKCE is not supported for confidential clients.**

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["user-read-email", "user-read-private"];
const url = await spotify.createAuthorizationURL(state, null, scopes);
```

For public clients, pass the state, PKCE code verifier, and scopes.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["user-read-email", "user-read-private"];
const url = await spotify.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

For confidential clients, pass the authorization code.

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Spotify returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await spotify.validateAuthorizationCode(code, null);
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

For public clients, pass the authorization code and code verifier.

```ts
const tokens = await spotify.validateAuthorizationCode(code, codeVerifier);
```

### Refresh access tokens

Use `refreshAccessToken()` to get a new access token using a refresh token. Spotify returns the same values as during the authorization code validation. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	const tokens = await spotify.refreshAccessToken(refreshToken);
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

Use the [`/users/me` endpoint](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile). The `user-read-email` scope is required to get the user's email.

```ts
const response = await fetch("https://api.spotify.com/v1/me", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
