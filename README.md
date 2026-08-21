# Antarctic

Antarctic is a fork of [Arctic](https://arcticjs.dev) by [pilcrowOnPaper](https://github.com/pilcrowOnPaper), adding a high level auth layer on top of its OAuth 2.0 clients. Only the authorization code flow is supported. Built on top of the Fetch API, it's light weight, fully-typed, and runtime-agnostic.

All of the OAuth 2.0 clients and provider coverage are Arctic's work. If you only need those, use [Arctic](https://arcticjs.dev) directly. See [credits](#credits).

```
npm install antarctic
```

## High-level API

Construct a provider with an options object and get two methods that handle the whole flow: `getAuthorizationURL()` and `getUser()`. State and PKCE values are generated for you and kept in a [polystore](https://polystore.dev) compatible key-value store.

```ts
import * as auth from "antarctic";
import kv from "polystore";

const store = kv(new Map());
const scopes = ["read:user", "user:email"];

const github = new auth.GitHub({ store, scopes });

// Redirect the user here to sign in.
const url = await github.getAuthorizationURL();

// In the OAuth callback route:
const user = await github.getUser(request.url);
// { id: "1", name: "The Octocat", email: "octocat@github.com", image: "https://..." }
```

`getUser()` accepts the callback query as a full URL, a query string, a `URLSearchParams`, or a plain object. It validates the `state`, exchanges the code (with PKCE where the provider supports it), fetches the profile, deletes the consumed state, and returns a normalized user: `{ id, name, email, image }`.

Options resolve as `explicit > environment > provider default`. Every option except `store` can come from the environment, named after the provider:

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

The environment is read when the provider is constructed, so load your `.env` file first. See the [high level API guide](https://documentation.page/github/franciscop/antarctic/documentation/high-level-api) for the details.

Errors thrown by the high-level layer: `InvalidOAuthStateError`, `InvalidOAuthCallbackError`, `OAuthConfigurationError`, and `OAuthProviderError`.

Sessions, cookies, and your user database remain your responsibility: take the returned user and plug it into your framework of choice.

## Low-level API

The original Arctic API is unchanged and remains available on the same objects, including the positional constructors:

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
