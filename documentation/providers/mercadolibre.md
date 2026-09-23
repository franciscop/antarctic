## Mercado Libre

OAuth 2.0 provider for Mercado Libre. This client requires PKCE to be enabled in your application settings.

Also see the [OAuth 2.0 with PKCE](/low-level-api#with-pkce) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const mercadolibre = new arctic.MercadoLibre(clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const url = await mercadolibre.createAuthorizationURL(state, codeVerifier);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). Mercado Libre returns an access token, its expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await mercadolibre.validateAuthorizationCode(code, codeVerifier);
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

Enable `offline_access` in your application settings to get a refresh token.

```ts
const tokens = await mercadolibre.validateAuthorizationCode(code, codeVerifier);
const refreshToken = tokens.refreshToken();
```

Use `refreshAccessToken()` to get a new access token using a refresh token. Mercado Libre returns the same values as during the authorization code validation. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	const tokens = await mercadolibre.refreshAccessToken(refreshToken);
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

Use the [`/users/me` endpoint](https://developers.mercadolibre.com.ar/es_ar/consulta-usuarios#Consultar-mis-datos-personales).

```ts
const response = await fetch("https://api.mercadolibre.com/users/me", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
