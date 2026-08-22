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

const authorizationEndpoint = "https://www.figma.com/oauth";
const tokenEndpoint = "https://api.figma.com/v1/oauth/token";
const refreshEndpoint = "https://api.figma.com/v1/oauth/refresh";
const userEndpoint = "https://api.figma.com/v1/me";

const envPrefix = "FIGMA";
const defaultScopes = ["current_user:read"];

export interface FigmaOptions extends ProviderOptions {}

export class Figma {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: FigmaOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | FigmaOptions,
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
		const tokens = await this.client.refreshAccessToken(refreshEndpoint, refreshToken, []);
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
		return {
			id: profileId(profile.id),
			name: profileString(profile.handle),
			email: profileString(profile.email),
			image: profileString(profile.img_url),
			raw: profile
		};
	}
}
