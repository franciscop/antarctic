## Overview

Every provider exposes the low-level API documented below: a constructor, `createAuthorizationURL()`, `validateAuthorizationCode()`, and where the provider supports them `refreshAccessToken()` and `revokeToken()`.

All of them except Synology also expose the [high level API](/documentation/high-level-api), `getAuthorizationURL()` and `getUser()`. Synology publishes no user profile endpoint, so it stays low-level only.

This table lists the environment prefix each provider reads its options from and the scopes it requests when you set none.

| Provider                   | Class              | Environment            | Default scopes                                       |
| -------------------------- | ------------------ | ---------------------- | ---------------------------------------------------- |
| 42 School                  | `FortyTwo`         | `FORTY_TWO_*`          | `public`                                             |
| Amazon Cognito             | `AmazonCognito`    | `AMAZON_COGNITO_*`     | `openid`, `profile`, `email`                         |
| AniList                    | `AniList`          | `ANI_LIST_*`           | Set in the app settings                              |
| Apple                      | `Apple`            | `APPLE_*`              | `email`                                              |
| Atlassian                  | `Atlassian`        | `ATLASSIAN_*`          | `read:me`                                            |
| Auth0                      | `Auth0`            | `AUTH0_*`              | `openid`, `profile`, `email`                         |
| Authentik                  | `Authentik`        | `AUTHENTIK_*`          | `openid`, `profile`, `email`                         |
| Autodesk Platform Services | `Autodesk`         | `AUTODESK_*`           | `openid`, `user-profile:read`                        |
| Battle.net                 | `BattleNet`        | `BATTLE_NET_*`         | `openid`                                             |
| Bitbucket                  | `Bitbucket`        | `BITBUCKET_*`          | Set in the app settings                              |
| Box                        | `Box`              | `BOX_*`                | Set in the app settings                              |
| Bungie                     | `Bungie`           | `BUNGIE_*`             | Set in the app settings                              |
| Coinbase                   | `Coinbase`         | `COINBASE_*`           | `wallet:user:read`, `wallet:user:email`              |
| Discord                    | `Discord`          | `DISCORD_*`            | `identify`, `email`                                  |
| DonationAlerts             | `DonationAlerts`   | `DONATION_ALERTS_*`    | `oauth-user-show`                                    |
| Dribbble                   | `Dribbble`         | `DRIBBBLE_*`           | Set in the app settings                              |
| Dropbox                    | `Dropbox`          | `DROPBOX_*`            | `account_info.read`                                  |
| Epic Games                 | `EpicGames`        | `EPIC_GAMES_*`         | `basic_profile`                                      |
| Etsy                       | `Etsy`             | `ETSY_*`               | `email_r`                                            |
| Facebook                   | `Facebook`         | `FACEBOOK_*`           | `public_profile`, `email`                            |
| Figma                      | `Figma`            | `FIGMA_*`              | `current_user:read`                                  |
| Gitea                      | `Gitea`            | `GITEA_*`              | `read:user`                                          |
| GitHub                     | `GitHub`           | `GITHUB_*`             | `read:user`, `user:email`                            |
| GitLab                     | `GitLab`           | `GITLAB_*`             | `openid`, `profile`, `email`                         |
| Google                     | `Google`           | `GOOGLE_*`             | `openid`, `profile`, `email`                         |
| Intuit                     | `Intuit`           | `INTUIT_*`             | `openid`, `profile`, `email`                         |
| Kakao                      | `Kakao`            | `KAKAO_*`              | `profile_nickname`, `profile_image`, `account_email` |
| KeyCloak                   | `KeyCloak`         | `KEYCLOAK_*`           | `openid`, `profile`, `email`                         |
| Kick                       | `Kick`             | `KICK_*`               | `user:read`                                          |
| Lichess                    | `Lichess`          | `LICHESS_*`            | `email:read`                                         |
| Line                       | `Line`             | `LINE_*`               | `openid`, `profile`, `email`                         |
| Linear                     | `Linear`           | `LINEAR_*`             | `read`                                               |
| LinkedIn                   | `LinkedIn`         | `LINKEDIN_*`           | `openid`, `profile`, `email`                         |
| Mastodon                   | `Mastodon`         | `MASTODON_*`           | `read:accounts`                                      |
| Mercado Libre              | `MercadoLibre`     | `MERCADO_LIBRE_*`      | Set in the app settings                              |
| Mercado Pago               | `MercadoPago`      | `MERCADO_PAGO_*`       | Set in the app settings                              |
| Microsoft Entra ID         | `MicrosoftEntraId` | `MICROSOFT_ENTRA_ID_*` | `openid`, `profile`, `email`                         |
| MyAnimeList                | `MyAnimeList`      | `MY_ANIME_LIST_*`      | Set in the app settings                              |
| Naver                      | `Naver`            | `NAVER_*`              | Set in the app settings                              |
| Notion                     | `Notion`           | `NOTION_*`             | Set in the app settings                              |
| Okta                       | `Okta`             | `OKTA_*`               | `openid`, `profile`, `email`                         |
| osu!                       | `Osu`              | `OSU_*`                | `identify`                                           |
| Patreon                    | `Patreon`          | `PATREON_*`            | `identity`                                           |
| Polar                      | `Polar`            | `POLAR_*`              | `openid`, `profile`, `email`                         |
| Reddit                     | `Reddit`           | `REDDIT_*`             | `identity`                                           |
| Roblox                     | `Roblox`           | `ROBLOX_*`             | `openid`, `profile`                                  |
| Salesforce                 | `Salesforce`       | `SALESFORCE_*`         | `openid`, `profile`, `email`                         |
| Shikimori                  | `Shikimori`        | `SHIKIMORI_*`          | Set in the app settings                              |
| Slack (OpenID)             | `Slack`            | `SLACK_*`              | `openid`, `profile`, `email`                         |
| Spotify                    | `Spotify`          | `SPOTIFY_*`            | `user-read-email`, `user-read-private`               |
| Start.gg                   | `StartGG`          | `START_GG_*`           | `user.identity`, `user.email`                        |
| Strava                     | `Strava`           | `STRAVA_*`             | `read`                                               |
| Synology                   | `Synology`         | none                   | Low-level only                                       |
| TikTok                     | `TikTok`           | `TIKTOK_*`             | `user.info.basic`                                    |
| Tiltify                    | `Tiltify`          | `TILTIFY_*`            | `public`                                             |
| Tumblr                     | `Tumblr`           | `TUMBLR_*`             | `basic`                                              |
| Twitch                     | `Twitch`           | `TWITCH_*`             | `user:read:email`                                    |
| Twitter                    | `Twitter`          | `TWITTER_*`            | `users.read`, `tweet.read`                           |
| VK                         | `VK`               | `VK_*`                 | `email`                                              |
| Withings                   | `Withings`         | `WITHINGS_*`           | `user.info`                                          |
| WorkOS                     | `WorkOS`           | `WORKOS_*`             | Set in the app settings                              |
| Yahoo                      | `Yahoo`            | `YAHOO_*`              | `openid`, `profile`, `email`                         |
| Yandex                     | `Yandex`           | `YANDEX_*`             | `login:info`, `login:email`, `login:avatar`          |
| Zoom                       | `Zoom`             | `ZOOM_*`               | `user:read:user`                                     |

Providers listed as "set in the app settings" build an authorization URL without a scope parameter, so they ignore both the `scopes` option and the environment variable.
