## Linear

OAuth 2.0 provider for Linear.

Also see the [OAuth 2.0](/documentation/oauth2) guide.

### Initialization

```ts
import * as arctic from "antarctic";

const linear = new arctic.Linear(clientId, clientSecret, redirectURI);
```

### Create authorization URL

**The `read` scope must always be included.**

```ts
import * as arctic from "antarctic";

const state = arctic.generateState();
const scopes = ["read", "write"];
const url = linear.createAuthorizationURL(state, scopes);
```

### Validate authorization code

`validateAuthorizationCode()` will either return an [`OAuth2Tokens`](/documentation/reference#oauth2tokens), or throw one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), [`UnexpectedResponseError`](/documentation/reference#unexpectedresponseerror), or [`UnexpectedErrorResponseBodyError`](/documentation/reference#unexpectederrorresponsebodyerror). Linear will return an access token with an expiration.

```ts
import * as arctic from "antarctic";

try {
	const tokens = await linear.validateAuthorizationCode(code);
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

### Get user profile

Use Linear's [GraphQL API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api).

```ts
const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    body: `{ "query": "{ viewer { id name } }" }`,
	headers: {
        "Content-Type": "application/json"
		Authorization: `Bearer ${accessToken}`
	}
});
const user = await response.json();
```
