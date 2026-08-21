## Withings

OAuth 2.0 provider for Withings.

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const withings = new arctic.Withings(clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["user.info", "user.metrics", "user.activity"];
const url = withings.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Withings will return an access token with an expiration.

Withings deviates from the RFC and the value of `OAuth2RequestError.code` will not be a registered OAuth 2.0 error code.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await withings.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
	const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
} catch (e) {
	if (e instanceof arctic.OAuth2RequestError) {
		// Invalid authorization code, credentials, or redirect URI
		const responseBody = e.code;
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

### Get measures

Use the `/measure` endpoint. See [the API docs](https://developer.withings.com/api-reference/#tag/measure).

```ts
const response = await fetch("https://wbsapi.withings.net/measure", {
	method: "POST",
	headers: {
		Authorization: `Bearer ${tokens.accessToken()}`,
		"Content-Type": "application/json"
	},
	body: JSON.stringify({
		action: "getmeas",
		meastypes: "1,5,6,8,76",
		category: 1,
		lastupdate: 1746082800
	})
});
const measures = await response.json();
```
