## Discord

OAuth 2.0 provider for Discord.

Also see the [OAuth 2.0](/documentation/oauth2) guide for confidential clients and the [OAuth 2.0 with PKCE](/documentation/oauth2-with-pkce) guide for public clients.

### Initialization

Pass the client secret for confidential clients.

```ts
import * as arctic from "antarctic";

const discord = new arctic.Discord(clientId, clientSecret, redirectURI);
const discord = new arctic.Discord(clientId, null, redirectURI);
```

### Create authorization URL

For confidential clients, pass the state and scopes. **PKCE is not supported for confidential clients.**

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["email", "activities.read"];
const url = discord.createAuthorizationURL(state, null, scopes);
```

For public clients, pass the state, PKCE code verifier, and scopes.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["email", "activities.read"];
const url = discord.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Discord returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await discord.validateAuthorizationCode(code);
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

Use `refreshAccessToken()` to get a new access token using a refresh token. Discord returns the same values as during the authorization code validation. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	const tokens = await discord.refreshAccessToken(refreshToken);
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

Add the `identify` scope and use the [`/users/@me` endpoint](https://discord.com/developers/docs/resources/user#get-current-user).

```ts
const scopes = ["identify"];
const url = discord.createAuthorizationURL(state, scopes);
```

```ts
const response = await fetch("https://discord.com/api/users/@me", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```

### Revoke tokens

Pass a token to `revokeToken()` to revoke all tokens associated with the authorization. This can throw the same errors as `validateAuthorizationCode()`.

```ts
try {
	await discord.revokeToken(token);
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
