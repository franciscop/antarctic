# High-level API

Every provider exposes two methods that cover the whole authorization code flow: `getAuthorizationURL()` and `getUser()`. They generate and validate `state`, handle PKCE where the provider supports it, exchange the code, and return a normalized user.

They require the options form of the constructor. Every option can come from the environment, so the object itself is optional:

```ts
import * as auth from "antarctic";

const github = new auth.GitHub(); // reads GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
const custom = new auth.GitHub({ scopes: ["read:user", "user:email"] });
```

Apple is the exception: its `pkcs8PrivateKey` has no environment variable, so it always takes an options object.

Antarctic keeps nothing between the two steps. You hold on to the `state` and `payload` from the first call and hand them back to the second, usually in a signed, `httpOnly` cookie.

## Authorization

`getAuthorizationURL()` generates a fresh `state` and, when the provider uses PKCE, a code verifier. It returns the URL to redirect the user to, along with both values:

```ts
const { url, state, payload } = await github.getAuthorizationURL();
setCookie("oauth", JSON.stringify({ state, payload }), {
	secure: true, // set to false in localhost
	path: "/",
	httpOnly: true,
	maxAge: 60 * 10 // 10 min
});
return Response.redirect(url);
```

`state` is the CSRF token and `payload` carries the PKCE verifier, empty for providers without PKCE. Keep both until the callback. The cookie's `maxAge` is how long the user has to finish signing in.

It takes an optional scope list, covered in [Scopes](#scopes).

## Callback

`getUser()` takes the callback query and the `{ state, payload }` you kept, and returns the authenticated user. It compares your `state` against the one the provider echoed back, which is the CSRF check, then exchanges the code with the PKCE verifier, and fetches the provider's profile.

```ts
const saved = JSON.parse(getCookie("oauth"));
deleteCookie("oauth");
const user = await github.getUser(request.url, saved);
```

Delete the cookie once it is read, so the same state cannot be used twice.

The query can be a full URL, a query string, a `URLSearchParams`, or a plain object, so it fits whatever your framework hands you:

```ts
await github.getUser(ctx.url.query, saved);
await github.getUser("?code=abc&state=xyz", saved);
await github.getUser(new URL(request.url).searchParams, saved);
```

The result is the same shape for every provider:

```ts
{
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

Fields a provider does not expose are `null`. Reddit and Strava, for example, never return an email.

`raw` carries the provider's own payload for the fields the normalized shape does not model, such as a GitHub `company`, a Google `hd` domain, or a Keycloak `groups` claim:

```ts
const user = await github.getUser(request.url, saved);
user.raw?.company;
```

For providers with a user endpoint it is that response. For OIDC providers it is the decoded ID token claims.

`accessToken` is what makes the granted scopes usable, so you can call the provider's API as the user without running the flow again. `refreshToken` and `scopes` are `null` when the provider did not return them, which is the common case unless you asked for offline access:

```ts
const user = await github.getUser(request.url, saved);
await fetch("https://api.github.com/user/repos", {
	headers: { Authorization: `Bearer ${user.accessToken}` }
});
```

Sessions, cookies, and your own user table are out of scope: take the returned user and store it however your application needs.

## Configuration

Provider options:

```ts
{
	clientId?: string;
	clientSecret?: string;
	redirectURI?: string;
	scopes?: string[];
}
```

Every option resolves as `explicit > environment > provider default`. Environment variables are named after the provider:

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
const github = new auth.GitHub({ scopes: ["read:user"] });

await github.getAuthorizationURL(); // read:user
await github.getAuthorizationURL(["repo"]); // repo
```

The provider default is the minimal set that yields a full profile, so most applications can leave scopes unset and let the environment override them per deployment.

An empty array requests no scopes at all, and beats the environment like any other explicit value. Build the array deliberately if you compute it:

```ts
new auth.GitHub({ scopes: [] }); // the authorization URL has no scope parameter
```

Some providers take their scopes from their app settings rather than the authorization URL, and ignore both the option and the variable: AniList, Bitbucket, MercadoLibre, MercadoPago, MyAnimeList, Naver, Notion, Shikimori, and WorkOS.

## Errors

- `OAuthConfigurationError`: a required option is missing, or a high-level method was called on a provider built with the positional constructor.
- `InvalidOAuthCallbackError`: the callback query has no `code` or `state`, or the saved `payload` has no PKCE verifier for a provider that needs one.
- `InvalidOAuthStateError`: the saved `state` does not match the one in the callback query.
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

Both constructors build the same class, so you can mix the two APIs. `getAuthorizationURL()` and `getUser()` throw `OAuthConfigurationError` unless the instance was created with the options form.
