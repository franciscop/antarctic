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

const authorizationEndpoint = "https://www.tumblr.com/oauth2/authorize";
const tokenEndpoint = "https://api.tumblr.com/v2/oauth2/token";
const userEndpoint = "https://api.tumblr.com/v2/user/info";

const envPrefix = "TUMBLR";
const defaultScopes = ["basic"];

export interface TumblrOptions extends ProviderOptions {}

export class Tumblr {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: TumblrOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | TumblrOptions,
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
			this.client = new OAuth2Client(clientIdOrOptions, clientSecret ?? null, redirectURI ?? null);
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
		const profile = await fetchUserProfile(userEndpoint, tokens.accessToken());
		let user: Record<string, unknown> = {};
		if (typeof profile.response === "object" && profile.response !== null) {
			const inner = (profile.response as Record<string, unknown>).user;
			if (typeof inner === "object" && inner !== null) {
				user = inner as Record<string, unknown>;
			}
		}
		// Tumblr only exposes the username: no stable numeric id, email, or avatar.
		return {
			id: profileId(user.name),
			name: profileString(user.name),
			email: null,
			image: null,
			raw: user
		};
	}
}
