## Facebook

OAuth 2.0 provider for Facebook.

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const facebook = new arctic.Facebook(clientId, clientSecret, redirectURI);
```

### Create authorization URL

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["email", "public_profile"];
const url = facebook.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Facebook will return an access token with an expiration.

Unlike other providers, this will not throw `OAuth2RequestError`. Facebook's error response is not compliant with the RFC and you must manually parse the response body to get the specific error message.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await facebook.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
	const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
} catch (e) {
	if (e instanceof arctic.UnexpectedErrorResponseBodyError) {
		// Invalid authorization code, credentials, or redirect URI
		const responseBody = e.data;
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

Use the `/me` endpoint. See [user fields](https://developers.facebook.com/docs/graph-api/reference/user#Reading).

```ts
const searchParams = new URLSearchParams();
searchParams.set("access_token", accessToken);
searchParams.set("fields", ["id", "name", "picture", "email"].join(","));
const response = await fetch("https://graph.facebook.com/me" + "?" + searchParams.toString());
const user = await response.json();
```
