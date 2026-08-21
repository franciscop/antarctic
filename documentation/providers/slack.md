## Slack (OpenID)

OAuth 2.0 provider for Slack (OpenID Connect).

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

The redirect URI is optional.

```ts
import * as arctic from "antarctic";

const slack = new arctic.Slack(clientId, clientSecret, null);
const slack = new arctic.Slack(clientId, clientSecret, redirectURI);
```

### Create authorization URL

**The `openid` scope is required.**

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["openid", "profile"];
const url = slack.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Slack will return an access token (no expiration) and an ID token.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await slack.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();
	const idToken = tokens.idToken();
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

Decode the ID token or the `userinfo` endpoint to get the user profile. Antarctic provides [`decodeIdToken()`](/documentation/reference#decodeidtoken) for decoding the token's payload.

```ts
import * as arctic from "antarctic";

const claims = arctic.decodeIdToken(idToken);
```

```ts
const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
	headers: {
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```

Make sure to add the `profile` scope to get the user profile and the `email` scope to get the user email.

```ts
const scopes = ["openid", "profile", "email"];
const url = slack.createAuthorizationURL(state, codeVerifier, scopes);
```
