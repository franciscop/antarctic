## Amazon Cognito

OAuth 2.0 authorization code provider for Amazon Cognito.

Also see [OAuth 2.0 with PKCE](/documentation/oauth2-with-pkce).

### Initialization

The domain should not include the protocol or path. Pass a client secret for confidential clients.

```ts
import * as arctic from "antarctic";

const domain = "<POOL-DOMAIN>.auth.<REGION>.amazoncognito.com";
const cognito = new arctic.AmazonCognito(domain, clientId, clientSecret, redirectURI);
const cognito = new arctic.AmazonCognito(domain, clientId, null, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile"];
const url = await cognito.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Cognito returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await cognito.validateAuthorizationCode(code, codeVerifier);
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

Use `refreshAccessToken()` to get a new access token using a refresh token. This method's behavior is identical to `validateAuthorizationCode()`. Cognito will only return a new access token.

```ts
import * as arctic from "antarctic";

try {
	// Pass an empty `scopes` array to keep using the same scopes.
	const tokens = await cognito.refreshAccessToken(refreshToken, scopes);
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

### OpenID Connect

Use OpenID Connect with the `openid` scope to get the user's profile with an ID token or the `userinfo` endpoint. Antarctic provides [`decodeIdToken()`](/documentation/reference#decodeidtoken) for decoding the token's payload.

```ts
const scopes = ["openid"];
const url = await cognito.createAuthorizationURL(state, codeVerifier, scopes);
```

```ts
import * as arctic from "antarctic";

const tokens = await cognito.validateAuthorizationCode(code, codeVerifier);
const idToken = tokens.idToken();
const claims = arctic.decodeIdToken(idToken);
```

```ts
const response = await fetch(userPool + "/oauth/userInfo", {
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
const url = await cognito.createAuthorizationURL(state, codeVerifier, scopes);
```

### Revoke refresh tokens

Pass a refresh token to `revokeToken()` to revoke all tokens associated with the authorization. This can throw the same errors as `validateAuthorizationCode()`.

```ts
try {
	await cognito.revokeToken(refreshToken);
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

> Token revocation must be enabled in the settings.
