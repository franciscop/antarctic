## Yandex

OAuth 2.0 provider for Yandex.

Also see the [OAuth 2.0](/low-level-api#without-pkce) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const yandex = new arctic.Yandex(clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["login:info", "login:email"];
const url = yandex.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). Yandex returns an access token, the access token expiration, and a refresh token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await yandex.validateAuthorizationCode(code);
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

Use `refreshAccessToken()` to get a new access token using a refresh token. Yandex returns the same values as during the authorization code validation. This method also returns `OAuth2Tokens` and throws the same errors as `validateAuthorizationCode()`

```ts
import * as arctic from "antarctic";

try {
	const tokens = await yandex.refreshAccessToken(refreshToken);
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

Use the [`/info` endpoint](https://yandex.com/dev/id/doc/en/user-information).

```ts
const response = await fetch("https://login.yandex.ru/info?format=json", {
	headers: {
		Authorization: `OAuth ${accessToken}`
	}
});
const user = await response.json();
```
