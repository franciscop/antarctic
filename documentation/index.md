# Antarctic

Antarctic is a collection of OAuth 2.0 clients for popular providers, with a high level layer that handles the whole sign-in flow for you. It is a fork of [Arctic](https://arcticjs.dev) by [pilcrowOnPaper](https://github.com/pilcrowOnPaper), whose work is every OAuth 2.0 client and provider here. Only the authorization code flow is supported. Built on the Fetch API, it is light weight, fully typed, and runtime agnostic.

```
npm install antarctic
```

## Quick start

Send the user to the authorization URL, keep the `state` and `payload` it returns until they come back, and read them in your callback route.

```ts
import * as auth from "antarctic";

const github = new auth.GitHub();

// Where you start the login.
const { url, state, payload } = await github.getAuthorizationURL();
setCookie("oauth", JSON.stringify({ state, payload }), {
	secure: true, // set to false in localhost
	path: "/",
	httpOnly: true,
	maxAge: 60 * 10 // 10 min
});

// In your OAuth callback route.
const user = await github.getUser(request.url, JSON.parse(getCookie("oauth")));
// { id: "1", name: "The Octocat", email: "octocat@github.com", image: "https://..." }
```

`getAuthorizationURL()` generates the `state` and the PKCE verifier and returns them alongside the `url`. `getUser()` checks the `state` against the one you kept, exchanges the code, fetches the profile, and returns the same shape for every provider: `{ id, name, email, image, raw, accessToken, refreshToken, scopes }`.

Credentials come from the environment when you do not pass them, so the example above reads `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. See the [high level API](/high-level-api) for the full flow, and [providers](/providers) for what each one supports.

## Low-level API

Arctic's low-level API is available on the same classes, for when you want to drive the flow yourself:

```ts
import * as arctic from "antarctic";

const github = new arctic.GitHub(clientId, clientSecret, redirectURI);

const state = arctic.generateState();
const url = github.createAuthorizationURL(state, ["user:email"]);
const tokens = await github.validateAuthorizationCode(code);
const accessToken = tokens.accessToken();
```

See the [low-level API](/low-level-api) for the full flow, with and without PKCE, and the generic client for providers that are not listed.

## Scope

Antarctic handles OAuth, PKCE, state, the provider APIs, and normalized identity. Sessions, cookies, your user table, and framework routing stay yours: take the user that `getUser()` returns and store it however your application needs.

> Antarctic only supports providers that follow the OAuth 2.0 spec, including PKCE and token revocation.

## Credits

Antarctic is a fork of [Arctic](https://github.com/pilcrowonpaper/arctic), created and maintained by [pilcrowOnPaper](https://github.com/pilcrowOnPaper). The OAuth 2.0 clients, the provider implementations, and the reference documentation are their work. Antarctic adds `getAuthorizationURL()`, `getUser()`, and the option resolution around them.

Arctic is MIT licensed. Antarctic keeps that license and the original copyright notice, and adds its own for the new work.

If you only need the OAuth 2.0 clients without the high level layer, use [Arctic](https://arcticjs.dev) directly. Provider issues that are not specific to Antarctic's additions are best reported upstream, where they benefit everyone.
