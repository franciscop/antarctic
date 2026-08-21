# From Arctic

Antarctic forks Arctic 3.7. The low level API is identical, so moving from Arctic v3 means changing the import and nothing else:

```ts
import * as arctic from "antarctic";
```

The package name on npm is `antarctic`. Everything documented under [reference](/documentation/reference) behaves exactly as it did, and the [high level API](/documentation/high-level-api) is added on top.

If you are on an older Arctic, upgrade through the sections below first. They are the upstream migration notes, kept here because the same changes apply on the way to Antarctic.

## Arctic v2 to v3

Arctic v3 is here! This is a small major release that adds support for public OAuth clients. There are only a few breaking changes and most breaking changes are small.

```
npm install arctic@latest
```

### Public clients

For providers that support public clients, you now have the option to pass `null` as the `clientSecret` value.

```ts
import * as arctic from "arctic";

const keycloak = new arctic.KeyCloak(clientId, null, redirectURI);
```

Providers that support PKCE only for public clients now have an optional `codeVerifier` parameter in `createAuthorizationURL()` and `validateAuthorizationCode()` methods. For existing providers that use confidential clients, pass `null`.

```ts
// Confidential clients (existing projects)
const url = discord.createAuthorizationURL(state, null, scopes);
const tokens = await discord.validateAuthorizationCode(code, null);

// Public clients
const url = discord.createAuthorizationURL(state, codeVerifier, scopes);
const tokens = await discord.validateAuthorizationCode(code, codeVerifier);
```

Providers affected by this breaking change are: Auth0, Discord, Spotify, and WorkOS.

### Self-hosted providers

All providers that can be self-hosted now use a unified `baseURL` parameter in their constructors. This is a breaking change only for the GitLab and Authentik provider.

```ts
import * as arctic from "arctic";

// Must include the protocol, can include path segments
const baseURL = "https://my-instance.com/auth";
const gitlab = new arctic.GitLab(baseURL, clientId, clientSecret, redirectURI);
```

### Custom domain providers

All providers that can be hosted under a custom domain now use a unified `domain` parameter in their constructors. This is a breaking change only for the AWS Cognito provider.

```ts
import * as arctic from "arctic";

// Must not include the protocol or path segments
const domain = "my-domain.com";
const cognito = new arctic.AmazonCognito(domain, clientId, clientSecret, redirectURI);
```

### Other changes and details

Please see the [changelog](https://github.com/pilcrowonpaper/arctic/releases/tag/v3.0.0) for details and other small changes.

## Arctic v1 to v2

Arctic v2 is here! This update changes how tokens are handled and introduces various small improvements. Behind the scenes, it's also fully type-safe now! We used to heavily rely on type assertion but this upgrade adds proper `in` and `typeof` checks!

```
npm install arctic@2
```

### Authorization URL

`createAuthorizationURL()` is no longer asynchronous and you can pass the scopes array directly.

```ts
const scopes = ["user:email", "repo"];
const url = github.createAuthorizationURL(state, scopes);
```

### Authorization code validation

`validateAuthorizationCode()` returns an [`OAuth2Token`](/documentation/reference#oauth2tokens) instead of a simple object. To get the access token, call the `accessToken()` method. These methods will throw an error if the field doesn't exist.

```ts
const tokens = await github.validateAuthorizationCode(code);
const accessToken = tokens.accessToken();
const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
const refreshToken = tokens.refreshToken();
const idToken = tokens.idToken();
```

Use `hasRefreshToken()` to check if the `refresh_token` field exists.

```ts
if (tokens.hasRefreshToken()) {
	const refreshToken = tokens.refreshToken();
}
```

`validateAuthorizationCode()` throws one of [`OAuth2RequestError`](/documentation/reference#oauth2requesterror), [`ArcticFetchError`](/documentation/reference#arcticfetcherror), or `Error`.

```ts
import * as arctic from "arctic";

try {
	const tokens = await github.validateAuthorizationCode(code);
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

### OpenID Connect

Providers no longer include the `openid` scope by default.

```ts
const scopes = ["openid", "profile"];
const url = google.createAuthorizationURL(state, codeVerifier, scopes);
```

### Initialization

The initialization parameters have changed for a few providers. See each provider's guide for details.

- [Apple](/documentation/providers#apple)
- [GitHub](/documentation/providers#github)
- [GitLab](/documentation/providers#gitlab)
- [Microsoft Entra ID](/documentation/providers#microsoft-entra-id)
- [MyAnimeList](/documentation/providers#myanimelist)
- [Okta](/documentation/providers#okta)
- [osu!](/documentation/providers#osu)
- [Salesforce](/documentation/providers#salesforce)

### Token revocation

Token revocation API has been added for providers that support it.

```ts
await google.revokeToken(token);
```
