import { OAuth2Client } from "../client.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthState,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	resolveOAuthState,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type {
	AuthorizationRequest,
	AuthConfig,
	OAuthCallbackQuery,
	OAuthUser,
	ProviderOptions,
	SavedOAuthState
} from "../auth.js";

const authorizationEndpoint = "https://www.epicgames.com/id/authorize";
const tokenEndpoint = "https://api.epicgames.dev/epic/oauth/v2/token";
const tokenRevocationEndpoint = "https://api.epicgames.dev/epic/oauth/v2/revoke";
const userinfoEndpoint = "https://api.epicgames.dev/epic/oauth/v2/userInfo";

const envPrefix = "EPIC_GAMES";
const defaultScopes = ["basic_profile"];

export interface EpicGamesOptions extends ProviderOptions {}

export class EpicGames {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: EpicGamesOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | EpicGamesOptions,
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

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(tokenRevocationEndpoint, token);
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state, resolveScopes(scopes, auth, defaultScopes));
		const payload = {};
		await saveOAuthState(auth.store, state, payload);
		return { url, state, payload };
	}

	public async getUser(query: OAuthCallbackQuery, saved?: SavedOAuthState): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await resolveOAuthState(auth.store, state, saved);
		const tokens = await this.validateAuthorizationCode(code);
		const claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
		return {
			id: profileId(claims.sub),
			name: profileString(claims.preferred_username),
			// Epic Games does not expose user emails or avatars.
			email: null,
			image: null,
			raw: claims,
			...extractOAuthTokens(tokens)
		};
	}
}
