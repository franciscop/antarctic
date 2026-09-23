## Polar

OAuth 2.0 authorization code provider for Polar. Pass the client secret for confidential clients.

Also see [OAuth 2.0 with PKCE](/low-level-api#with-pkce).

### Initialization

```ts
import * as arctic from "antarctic";

const polar = new arctic.Polar(clientId, clientSecret, redirectURI);
const polar = new arctic.Polar(clientId, null, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile"];
const url = await polar.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). Polar returns an access token, its expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await polar.validateAuthorizationCode(code, codeVerifier);
	const accessToken = tokens.accessToken();
	const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
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

Use OpenID Connect with the `openid` scope to get the user's profile with an ID token or the `userinfo` endpoint. Antarctic provides [`decodeIdToken()`](/reference#decodeidtoken) for decoding the token's payload.

```ts
const scopes = ["openid"];
const url = await polar.createAuthorizationURL(state, codeVerifier, scopes);
```

```ts
import * as arctic from "antarctic";

const tokens = await polar.validateAuthorizationCode(code, codeVerifier);
const idToken = tokens.idToken();
const claims = arctic.decodeIdToken(idToken);
```

```ts
const response = await fetch("https://api.polar.sh/v1/oauth2/userinfo", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```

#### Get user profile

Make sure to add the `profile` scope to get the user profile and the `email` scope to get the user email.

```ts
const scopes = ["openid", "profile", "email"];
const url = await polar.createAuthorizationURL(state, codeVerifier, scopes);
```

### Refresh tokens

Use `refreshAccessToken()` to get a new access token using a refresh token. This method's behavior is identical to `validateAuthorizationCode()`.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await polar.refreshAccessToken(refreshToken);
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

Revoke tokens with `revokeToken()`. This can throw the same errors as `validateAuthorizationCode()`.

```ts
try {
	await polar.revokeToken(token);
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
