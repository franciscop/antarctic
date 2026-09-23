## Notion

OAuth 2.0 provider for Notion.

Also see the [OAuth 2.0](/low-level-api#without-pkce) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const notion = new arctic.Notion(clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const url = notion.createAuthorizationURL(state);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/reference#oauth2requesterror), [`ArcticFetchError`](/reference#arcticfetcherror), [`UnexpectedResponseError`](/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/reference#unexpectederrorresponsebodyerror). Notion will only return an access token (no expiration).

```ts
import * as arctic from "antarctic";

try {
	const tokens = await notion.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
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

Use the [`/users/me` endpoint](https://developers.notion.com/reference/get-self).

```ts
const response = await fetch("https://api.notion.com/v1/users/me", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
