## VK

OAuth 2.0 provider for VK.

Also see the [OAuth 2.0](/low-level-api#without-pkce) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const vk = new arctic.VK(clientId, clientSecret, redirectURI);
```

### Create authorization URL

Optionally use the `offline` scope to get access tokens with no expiration.

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["email", "messages", "offline"];
const url = vk.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). VK will return an access token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await vk.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
	// Only if `offline` scope is not used.
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

### Get user profile

Use the [`users.get` endpoint](https://dev.vk.com/en/method/users.get).

```ts
const response = await fetch("https://api.vk.com/method/users.get", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
