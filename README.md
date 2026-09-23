# Antarctic

Antarctic is a fork of [Arctic](https://arcticjs.dev) by [pilcrowOnPaper](https://github.com/pilcrowOnPaper), adding a high level auth layer on top of its OAuth 2.0 clients. Only the authorization code flow is supported. Built on top of the Fetch API, it's light weight, fully-typed, and runtime-agnostic.

Read the documentation at [antarcticjs.dev](https://antarcticjs.dev).

All of the OAuth 2.0 clients and provider coverage are Arctic's work. If you only need those, use [Arctic](https://arcticjs.dev) directly. See [credits](#credits).

```
npm install antarctic
```

## High-level API

Every provider except Synology has two methods that run the whole sign-in flow: `getAuthorizationURL()` starts it and `getUser()` finishes it in your callback route. Antarctic keeps nothing in between: you hold the `state` and `payload` from the first call, usually in a signed cookie, and pass them to the second.

```ts
import * as auth from "antarctic";

const github = new auth.GitHub();

// Login route
const { url, state, payload } = await github.getAuthorizationURL();
setCookie("oauth", JSON.stringify({ state, payload }), { httpOnly: true, maxAge: 600 });
return Response.redirect(url);

// Callback route
const user = await github.getUser(request.url, JSON.parse(getCookie("oauth")));
// { id: "1", name: "The Octocat", email: "octocat@github.com", image: "https://...", ... }
```

### Options

```ts
new auth.GitHub({ clientId, clientSecret, redirectURI, scopes });
```

Every option is optional. A missing one falls back to an environment variable named after the provider, then to the provider default:

```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI
GITHUB_SCOPES
```

The environment is read when the provider is constructed, so load your `.env` file first. Some providers take extra options, such as Auth0's `domain` (`AUTH0_DOMAIN`). Apple always needs `{ pkcs8PrivateKey }`, which has no environment variable.

### `getAuthorizationURL(scopes?)`

Generates a fresh `state` and, where the provider uses PKCE, a code verifier. It returns:

- `url`: where to redirect the user.
- `state`: the CSRF token.
- `payload`: whatever `getUser()` needs later, such as the PKCE verifier. Keep it as it is.

### `getUser(query, { state, payload })`

Takes the callback query (a full URL, a query string, a `URLSearchParams`, or a plain object) and the `state` and `payload` you kept. It checks your `state` against the one in the query, exchanges the code, fetches the profile, and returns the same shape for every provider:

```ts
{
	(id, name, email, image, raw, accessToken, refreshToken, scopes);
}
```

`name`, `email`, and `image` are `null` when the provider does not expose them. `raw` is the provider's own profile, for the fields this shape does not cover. `scopes` are the ones the provider actually granted, or `null` if it does not say.

Delete the saved state once you read it, so it cannot be used twice.

### Scopes

Scopes are set per provider and can be overridden per login. From highest to lowest priority:

1. The argument to `getAuthorizationURL(scopes)`, for that login only.
2. The `scopes` option, for every login with that provider.
3. `GITHUB_SCOPES`, separated by commas, whitespace, or both.
4. The provider default, the minimal set that yields a full profile.

```ts
const github = new auth.GitHub({ scopes: ["read:user", "user:email"] });

await github.getAuthorizationURL(); // read:user user:email
await github.getAuthorizationURL(["read:user", "user:email", "repo"]); // this login only
```

An override replaces the list instead of adding to it, so repeat the scopes you still need. An empty array requests none. AniList, Bitbucket, MercadoLibre, MercadoPago, MyAnimeList, Naver, Notion, Shikimori, and WorkOS take their scopes from the app settings and ignore all of the above.

### Errors

- `OAuthConfigurationError`: a required option is missing from both the constructor and the environment, or a high-level method was called on a provider built with the positional constructor.
- `InvalidOAuthCallbackError`: the callback query has no `code` or `state`, or the `payload` lacks a PKCE verifier the provider needs.
- `InvalidOAuthStateError`: the saved `state` does not match the one in the callback query.
- `OAuthProviderError`: the provider returned an error, or a profile that cannot be used. `error.code` holds its error code when it sent one.

Sessions, cookies, and your user database remain your responsibility: take the returned user and plug it into your framework of choice. See the [documentation](https://antarcticjs.dev/high-level-api) for the details.

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

See the [low-level API](https://antarcticjs.dev/low-level-api) docs for the full flow.

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
