## Microsoft Entra ID

OAuth 2.0 provider for Microsoft Entra ID.

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

See [Endpoints](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols#endpoints) for more on the `tenant` parameter. Pass the client secret for confidential clients.

```ts
import * as arctic from "antarctic";

const entraId = new arctic.MicrosoftEntraId(tenant, clientId, clientSecret, redirectURI);
const entraId = new arctic.MicrosoftEntraId(tenant, clientId, null, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile"];
const url = entraId.createAuthorizationURL(state, codeVerifier, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Entra ID returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await entraId.validateAuthorizationCode(code, codeVerifier);
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

Use `refreshAccessToken()` to get a new access token using a refresh token. Entra ID returns the same values as during the authorization code validation. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	// Pass an empty `scopes` array to keep using the same scopes.
	const tokens = await entraId.refreshAccessToken(refreshToken, scopes);
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

Use OpenID Connect with the `openid` scope to get the user's profile with an ID token or the `userinfo` endpoint. The `nonce` parameter is required by Entra ID to use OpenID. Antarctic provides [`decodeIdToken()`](/documentation/reference#decodeidtoken) for decoding the token's payload.

```ts
const scopes = ["openid"];
const url = entraId.createAuthorizationURL(state, codeVerifier, scopes);
// The nonce should be unique to each request similar to state.
// However, nonce can just be "_" here since it isn't useful for server-based OAuth.
url.searchParams.set("nonce", nonce);
```

```ts
import * as arctic from "antarctic";

const tokens = await entraId.validateAuthorizationCode(code, codeVerifier);
const idToken = tokens.idToken();
const claims = arctic.decodeIdToken(idToken);
```

```ts
const response = await fetch("https://graph.microsoft.com/oidc/userinfo", {
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
const url = entraId.createAuthorizationURL(state, codeVerifier, scopes);
```
