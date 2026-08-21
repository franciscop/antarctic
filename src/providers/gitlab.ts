import { OAuth2Client } from "../client.js";
import { joinURIAndPath } from "../request.js";
import {
	consumeOAuthState,
	fetchUserProfile,
	generateOAuthState,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	requireProviderOption,
	resolveAuthConfig,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const envPrefix = "GITLAB";
const defaultScopes = ["openid", "profile", "email"];

export interface GitLabOptions extends ProviderOptions {
	baseURL?: string;
}

export class GitLab {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private tokenRevocationEndpoint: string;
	private baseURL: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: GitLabOptions);
	constructor(baseURL: string, clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		baseURLOrOptions: string | GitLabOptions,
		clientId?: string,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		if (typeof baseURLOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, baseURLOrOptions, { redirectURI: true });
			this.baseURL = requireProviderOption(
				baseURLOrOptions.baseURL,
				envPrefix,
				"BASE_URL",
				"baseURL"
			);
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			this.baseURL = baseURLOrOptions;
			this.client = new OAuth2Client(clientId ?? "", clientSecret ?? null, redirectURI ?? null);
		}
		this.authorizationEndpoint = joinURIAndPath(this.baseURL, "/oauth/authorize");
		this.tokenEndpoint = joinURIAndPath(this.baseURL, "/oauth/token");
		this.tokenRevocationEndpoint = joinURIAndPath(this.baseURL, "/oauth/revoke");
	}

	public createAuthorizationURL(state: string, scopes: string[]): URL {
		const url = this.client.createAuthorizationURL(this.authorizationEndpoint, state, scopes);
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(this.tokenEndpoint, code, null);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(this.tokenEndpoint, refreshToken, []);
		return tokens;
	}

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(this.tokenRevocationEndpoint, token);
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
		// GitLab id_tokens omit profile claims, so always use the OIDC userinfo endpoint.
		const userinfoEndpoint = joinURIAndPath(this.baseURL, "/oauth/userinfo");
		const claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name) ?? profileString(claims.nickname),
			email: profileString(claims.email),
			image: profileString(claims.picture)
		};
	}
}
