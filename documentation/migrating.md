# From Arctic

Antarctic forks Arctic 3.7 and is published as `antarctic`, so start by changing the import:

```ts
import * as arctic from "antarctic";
```

The [high level API](/documentation/high-level-api) is added on top of everything you already use. One low level change needs your attention.

## PKCE providers are asynchronous

Antarctic builds the PKCE code challenge with the platform's `crypto.subtle` rather than a hashing dependency, and SHA-256 is asynchronous there. Providers that use PKCE return a promise from `createAuthorizationURL()`:

```ts
const url = await google.createAuthorizationURL(state, codeVerifier, scopes);
```

Providers without PKCE are unchanged and still return a `URL` directly:

```ts
const url = github.createAuthorizationURL(state, scopes);
```

`OAuth2Client.createAuthorizationURLWithPKCE()` returns a promise for the same reason. The [providers](/documentation/providers) page lists which providers use PKCE, and nothing else in the [reference](/documentation/reference) changed.

## Older versions of Arctic

If you are on Arctic v1 or v2, upgrade to v3 first with the [upstream migration guides](https://arcticjs.dev), then follow the steps above.
