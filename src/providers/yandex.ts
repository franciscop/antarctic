import { OAuth2Client } from "../client.js";
import {
	consumeOAuthState,
	fetchUserProfile,
	generateOAuthState,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const authorizationEndpoint = "https://oauth.yandex.com/authorize";
const tokenEndpoint = "https://oauth.yandex.com/token";
const userEndpoint = "https://login.yandex.ru/info?format=json";

const envPrefix = "YANDEX";
const defaultScopes = ["login:info", "login:email", "login:avatar"];

export interface YandexOptions extends ProviderOptions {}

export class Yandex {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: YandexOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | YandexOptions,
		clientSecret?: string,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			this.client = new OAuth2Client(clientIdOrOptions, clientSecret ?? "", redirectURI ?? "");
		}
	}

	public createAuthorizationURL(state: string, scopes: string[]): URL {
		const url = this.client.createAuthorizationURL(authorizationEndpoint, state, scopes);
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(tokenEndpoint, code, null);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(tokenEndpoint, refreshToken, []);
		return tokens;
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state, resolveScopes(scopes, auth, defaultScopes));
		await saveOAuthState(auth.store, state, {});
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await consumeOAuthState(auth.store, state);
		const tokens = await this.validateAuthorizationCode(code);
		const accessToken = tokens.accessToken();
		// Yandex expects the "OAuth" scheme instead of "Bearer".
		const profile = await fetchUserProfile(userEndpoint, accessToken, {
			Authorization: `OAuth ${accessToken}`
		});
		const avatarId = profileString(profile.default_avatar_id);
		let image: string | null = null;
		if (avatarId !== null && profile.is_avatar_empty !== true) {
			image = `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
		}
		return {
			id: profileId(profile.id),
			name:
				profileString(profile.real_name) ??
				profileString(profile.display_name) ??
				profileString(profile.login),
			email: profileString(profile.default_email),
			image
		};
	}
}
