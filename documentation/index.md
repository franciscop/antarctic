# Antarctic

Antarctic is a collection of OAuth 2.0 clients for popular providers, with a high level layer that handles the whole sign-in flow for you. It is a fork of [Arctic](https://arcticjs.dev) by [pilcrowOnPaper](https://github.com/pilcrowOnPaper), whose work is every OAuth 2.0 client and provider here. Only the authorization code flow is supported. Built on the Fetch API, it is light weight, fully typed, and runtime agnostic.

```
npm install antarctic polystore
```

## Quick start

Construct a provider with a store, send the user to the authorization URL, and read them back in your callback route.

```ts
import * as auth from "antarctic";
import kv from "polystore";

const store = kv(new Map());
const github = new auth.GitHub({ store });

// Where you start the login.
const url = await github.getAuthorizationURL();

// In your OAuth callback route.
const user = await github.getUser(request.url);
// { id: "1", name: "The Octocat", email: "octocat@github.com", image: "https://..." }
```

`getAuthorizationURL()` generates the `state` and the PKCE verifier and keeps them in the store. `getUser()` validates the `state`, exchanges the code, fetches the profile, and returns the same `{ id, name, email, image }` shape for every provider.

Credentials come from the environment when you do not pass them, so the example above reads `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. See the [high level API](/documentation/high-level-api) for the full flow, and [providers](/documentation/providers) for what each one supports.

## Lower level

Arctic's low level API is available on the same objects, for when you want to drive the flow yourself. It is unchanged except that PKCE providers build the URL asynchronously, so `createAuthorizationURL()` returns a promise for them:

```ts
import * as arctic from "antarctic";

const github = new arctic.GitHub(clientId, clientSecret, redirectURI);

const state = arctic.generateState();
const url = github.createAuthorizationURL(state, ["user:email"]);
const tokens = await github.validateAuthorizationCode(code);
const accessToken = tokens.accessToken();
```

Start with the [OAuth 2.0](/documentation/oauth2) guide, or [OAuth 2.0 with PKCE](/documentation/oauth2-with-pkce) for providers that require it.

## Scope

Antarctic handles OAuth, PKCE, state, the provider APIs, and normalized identity. Sessions, cookies, your user table, and framework routing stay yours: take the user that `getUser()` returns and store it however your application needs.

> Antarctic only supports providers that follow the OAuth 2.0 spec, including PKCE and token revocation.

## Credits

Antarctic is a fork of [Arctic](https://github.com/pilcrowonpaper/arctic), created and maintained by [pilcrowOnPaper](https://github.com/pilcrowOnPaper). The OAuth 2.0 clients, the provider implementations, and the reference documentation are their work. Antarctic adds `getAuthorizationURL()`, `getUser()`, and the option resolution around them.

Arctic is MIT licensed. Antarctic keeps that license and the original copyright notice, and adds its own for the new work.

If you only need the OAuth 2.0 clients without the high level layer, use [Arctic](https://arcticjs.dev) directly. Provider issues that are not specific to Antarctic's additions are best reported upstream, where they benefit everyone.
