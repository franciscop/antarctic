# Antarctic

Antarctic is a fork of [Arctic](https://arcticjs.dev) by [pilcrowOnPaper](https://github.com/pilcrowOnPaper), adding a high level auth layer on top of its OAuth 2.0 clients. Only the authorization code flow is supported. Built on top of the Fetch API, it's light weight, fully-typed, and runtime-agnostic.

All of the OAuth 2.0 clients and provider coverage are Arctic's work. If you only need those, use [Arctic](https://arcticjs.dev) directly. See [credits](#credits).

```
npm install antarctic
```

## High-level API

Construct a provider with an options object and get two methods that handle the whole flow: `getAuthorizationURL()` and `getUser()`. State and PKCE values are generated for you, and you keep them between the two steps, for example in a signed cookie.

```ts
import * as auth from "antarctic";

const scopes = ["read:user", "user:email"];
const github = new auth.GitHub({ scopes });

// Redirect the user here to sign in, keeping state and payload in a cookie.
const { url, state, payload } = await github.getAuthorizationURL();

// In the OAuth callback route, with the state and payload read back:
const user = await github.getUser(request.url, { state, payload });
// { id: "1", name: "The Octocat", email: "octocat@github.com", image: "https://..." }
```

`getUser()` accepts the callback query as a full URL, a query string, a `URLSearchParams`, or a plain object. It checks the `state` against the one you kept, exchanges the code (with PKCE where the provider supports it), fetches the profile, and returns the user along with the tokens: `{ id, name, email, image, raw, accessToken, refreshToken, scopes }`.

Options resolve as `explicit > environment > provider default`. Every option can come from the environment, named after the provider:

```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI
GITHUB_SCOPES

GOOGLE_CLIENT_ID
...
```

`GITHUB_SCOPES` takes a list separated by commas, whitespace, or both. Scopes resolve as `argument > constructor > environment > provider default`, where the provider default is the minimal set that yields a full profile:

```ts
await github.getAuthorizationURL(["repo"]); // overrides the constructor and the environment
```

The environment is read when the provider is constructed, so load your `.env` file first. See the [documentation](https://documentation.page/github/franciscop/antarctic/) for the details.

Errors thrown by the high-level layer: `InvalidOAuthStateError`, `InvalidOAuthCallbackError`, `OAuthConfigurationError`, and `OAuthProviderError`.

Sessions, cookies, and your user database remain your responsibility: take the returned user and plug it into your framework of choice.

## Low-level API

Arctic's low level API remains available on the same objects, including the positional constructors. It is unchanged except that PKCE providers build the URL asynchronously, so `createAuthorizationURL()` returns a promise for them:

```ts
import * as arctic from "antarctic";

const github = new arctic.GitHub(clientId, clientSecret, redirectURI);

const state = arctic.generateState();
const scopes = ["user:email"];
const authorizationURL = github.createAuthorizationURL(state, scopes);

// ...

const tokens = await github.validateAuthorizationCode(code);
const accessToken = tokens.accessToken();
```

> Antarctic only supports providers that follow the OAuth 2.0 spec (including PKCE and token revocation).

## Compare to Arctic

Arctic gives you the OAuth primitives and leaves the flow to you: generating the state and PKCE verifier, checking the callback, and fetching and mapping the profile for each provider. Antarctic does all of that in two calls and returns the same user shape for every provider. Here is Google, which uses PKCE, in Arctic:

```ts
import * as arctic from "arctic";
// import * as arctic from "antarctic"; // Exactly the same for the low-level API

const google = new arctic.Google(clientId, clientSecret, redirectURI);

// Login route
const state = arctic.generateState();
const codeVerifier = arctic.generateCodeVerifier();
const scopes = ["openid", "profile", "email"];
const url = await google.createAuthorizationURL(state, codeVerifier, scopes);
setCookie("state", state, { httpOnly: true, maxAge: 600 });
setCookie("code_verifier", codeVerifier, { httpOnly: true, maxAge: 600 });
return Response.redirect(url);

// Callback route
const params = new URL(request.url).searchParams;
const code = params.get("code");
if (code === null || params.get("state") !== getCookie("state")) {
	throw new Error("Invalid request");
}
const tokens = await google.validateAuthorizationCode(code, getCookie("code_verifier"));
const claims = arctic.decodeIdToken(tokens.idToken());
// Map the claims to your own user shape, or fetch the profile for non-OIDC providers
```

And in Antarctic:

```ts
import * as auth from "antarctic";

const google = new auth.Google();

// Login route
const { url, state, payload } = await google.getAuthorizationURL();
setCookie("oauth", JSON.stringify({ state, payload }), { httpOnly: true, maxAge: 600 });
return Response.redirect(url);

// Callback route
const user = await google.getUser(request.url, JSON.parse(getCookie("oauth")));
// { id, name, email, image, raw, accessToken, refreshToken, scopes }
```

|                               | Arctic                | Antarctic                         |
| ----------------------------- | --------------------- | --------------------------------- |
| Credentials                   | Positional arguments  | Environment or options            |
| State and PKCE verifier       | You generate them     | Generated for you                 |
| Scopes                        | You pass them         | Per-provider default, overridable |
| Callback query and CSRF check | You parse and compare | Done in `getUser()`               |
| User profile                  | You fetch and map it  | Normalized user with the tokens   |

## Credits

Antarctic is a fork of [Arctic](https://github.com/pilcrowonpaper/arctic), created and maintained by [pilcrowOnPaper](https://github.com/pilcrowOnPaper). The OAuth 2.0 clients, the provider implementations, the docs those pages grew from, and the design that makes all of it consistent are their work. Antarctic adds one layer on top: `getAuthorizationURL()`, `getUser()`, and the option resolution around them.

Arctic is MIT licensed. Antarctic keeps that license and the original copyright notice, and adds its own for the new work. See [LICENSE](./LICENSE).

If you only need the OAuth 2.0 clients without the high level layer, use [Arctic](https://arcticjs.dev) directly. Please report provider issues that are not specific to Antarctic's additions upstream, where they benefit everyone.

## Semver

Antarctic does not strictly follow semantic versioning. While we aim to only introduce breaking changes in major versions, we may introduce them in a minor update if a provider updates their API in a non-backward compatible way. However, they will never be introduced in a patch update.

## Supported providers

- 42 School
- Amazon Cognito
- AniList
- Apple
- Atlassian
- Auth0
- Authentik
- Autodesk Platform Services
- Battle.net
- Bitbucket
- Box
- Bungie
- Coinbase
- Discord
- DonationAlerts
- Dribbble
- Dropbox
- Etsy
- Epic Games
- Facebook
- Figma
- Gitea
- GitHub
- GitLab
- Google
- Intuit
- Kakao
- KeyCloak
- Kick
- Lichess
- Line
- Linear
- LinkedIn
- Mastodon
- MercadoLibre
- MercadoPago
- Microsoft Entra ID
- MyAnimeList
- Naver
- Notion
- Okta
- osu!
- Patreon
- Polar
- Reddit
- Roblox
- Salesforce
- Shikimori
- Slack
- Spotify
- Start.gg
- Strava
- Synology
- TikTok
- Tiltify
- Tumblr
- Twitch
- Twitter
- VK
- WorkOS
- Yahoo
- Yandex
- Zoom
