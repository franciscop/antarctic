## ProviderOptions

The object form of every provider constructor.

```ts
interface ProviderOptions {
	clientId?: string;
	clientSecret?: string;
	redirectURI?: string;
	scopes?: string[];
	store: Store;
}
```

`store` is any [polystore](https://polystore.dev) compatible key-value store. Everything else falls back to the environment and then to the provider default. Providers that need extra values, such as Auth0's `domain`, add them to their own options interface.

## OAuthUser

The normalized profile returned by `getUser()`.

```ts
interface OAuthUser {
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	raw?: Record<string, unknown>;
	accessToken?: string;
	refreshToken?: string | null;
	scopes?: string[] | null;
}
```

Fields the provider does not expose are `null`.

`raw` is the provider's own payload, so you can read fields the normalized shape does not model. It is the profile response for providers with a user endpoint, and the decoded ID token claims for OIDC providers.

`accessToken` lets you call the provider's API as the user. `refreshToken` and `scopes` are `null` when the provider did not return them.

## AuthorizationRequest

What `getAuthorizationURL()` returns.

```ts
interface AuthorizationRequest {
	url: URL;
	state: string;
	payload: StoredOAuthState;
}
```

`payload` holds the PKCE verifier where the provider uses one, and is empty otherwise. Both `state` and `payload` are written to the store, and can be passed back to `getUser()` as `{ state, payload }` to skip it.

## OAuthConfigurationError

Thrown when a required option is missing, or when `getAuthorizationURL()` or `getUser()` is called on a provider built with the positional constructor.

## InvalidOAuthCallbackError

Thrown when the callback query has no `code` or `state`, or when the stored PKCE verifier is missing.

## InvalidOAuthStateError

Thrown when the `state` is unknown, expired, or already consumed.

## OAuthProviderError

Thrown when the provider returns an error in the callback query, or when its profile response cannot be used.

```ts
const error: OAuthProviderError;
error.code; // string | null, the provider's error code when it sent one
```

Secrets, tokens, and PKCE verifiers are never included in any of these messages.
