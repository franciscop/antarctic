# High-level API

Every provider exposes two methods that cover the whole authorization code flow: `getAuthorizationURL()` and `getUser()`. They generate and validate `state`, handle PKCE where the provider supports it, exchange the code, and return a normalized user.

They require the object form of the constructor, which takes a [polystore](https://polystore.dev) compatible key-value store:

```ts
import * as auth from "antarctic";
import kv from "polystore";

const store = kv(new Map());

const github = new auth.GitHub({
	store,
	scopes: ["read:user", "user:email"]
});
```

Any key-value store polystore supports works, including Redis, Cloudflare KV, and SQLite. Use a shared store in production so the flow survives across processes.

## Authorization

`getAuthorizationURL()` returns a `URL` to redirect the user to. It generates a fresh `state`, generates a PKCE verifier when the provider uses PKCE, and stores both under the `state` key for ten minutes.

```ts
const url = await github.getAuthorizationURL();
return Response.redirect(url);
```

It takes an optional scope list, covered in [Scopes](#scopes).

## Callback

`getUser()` takes the callback query and returns the authenticated user. It validates the `state` against the store, retrieves the PKCE verifier, exchanges the code, fetches the provider's profile, and deletes the consumed state so it cannot be replayed.

```ts
const user = await github.getUser(request.url);
```

The query can be a full URL, a query string, a `URLSearchParams`, or a plain object, so it fits whatever your framework hands you:

```ts
await github.getUser(ctx.url.query);
await github.getUser("?code=abc&state=xyz");
await github.getUser(new URL(request.url).searchParams);
```

The result is the same shape for every provider:

```ts
{
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	raw?: Record<string, unknown>;
}
```

Fields a provider does not expose are `null`. Reddit and Strava, for example, never return an email.

`raw` carries the provider's own payload for the fields the normalized shape does not model, such as a GitHub `company`, a Google `hd` domain, or a Keycloak `groups` claim:

```ts
const user = await github.getUser(request.url);
user.raw?.company;
```

For providers with a user endpoint it is that response. For OIDC providers it is the decoded ID token claims.

Sessions, cookies, and your own user table are out of scope: take the returned user and store it however your application needs.

## Configuration

Provider options:

```ts
{
	clientId?: string;
	clientSecret?: string;
	redirectURI?: string;
	scopes?: string[];
	store: Store;
}
```

Everything except `store` resolves as `explicit > environment > provider default`. Environment variables are named after the provider:

```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI
GITHUB_SCOPES
```

Providers that need extra values read them the same way: `AUTH0_DOMAIN`, `MICROSOFT_ENTRA_ID_TENANT`, `KEYCLOAK_REALM_URL`.

A variable set to an empty string counts as unset. The environment is read once, when the provider is constructed, so load your `.env` file before creating providers. On Cloudflare Workers, where `env` is a per-request binding rather than `process.env`, pass every option to the constructor.

## Scopes

`GITHUB_SCOPES` and its equivalents take a list separated by commas, whitespace, or both:

```
GITHUB_SCOPES=read:user,user:email
GITHUB_SCOPES="read:user user:email"
```

Scopes resolve as `argument > constructor > environment > provider default`:

```ts
const github = new auth.GitHub({ store, scopes: ["read:user"] });

await github.getAuthorizationURL(); // read:user
await github.getAuthorizationURL(["repo"]); // repo
```

The provider default is the minimal set that yields a full profile, so most applications can leave scopes unset and let the environment override them per deployment.

An empty array requests no scopes at all, and beats the environment like any other explicit value. Build the array deliberately if you compute it:

```ts
new auth.GitHub({ store, scopes: [] }); // the authorization URL has no scope parameter
```

Some providers take their scopes from their app settings rather than the authorization URL, and ignore both the option and the variable: AniList, Bitbucket, MercadoLibre, MercadoPago, MyAnimeList, Naver, Notion, Shikimori, and WorkOS.

## Errors

- `OAuthConfigurationError`: a required option is missing, or a high-level method was called on a provider built with the positional constructor.
- `InvalidOAuthCallbackError`: the callback query has no `code` or `state`, or the stored PKCE verifier is gone.
- `InvalidOAuthStateError`: the `state` is unknown, expired, or already consumed.
- `OAuthProviderError`: the provider returned an error or an unusable profile response.

Secrets, tokens, and PKCE verifiers are never included in error messages.

## Low-level API

The positional constructors and the underlying methods remain on the same object. PKCE providers build the URL asynchronously, so their `createAuthorizationURL()` returns a promise:

```ts
import * as arctic from "antarctic";

const github = new arctic.GitHub(clientId, clientSecret, redirectURI);

const state = arctic.generateState();
const url = github.createAuthorizationURL(state, ["user:email"]);
const tokens = await github.validateAuthorizationCode(code);
```

Both constructors build the same class, so you can mix the two APIs. `getAuthorizationURL()` and `getUser()` throw `OAuthConfigurationError` unless the instance was created with the object form, since only it carries a store.
