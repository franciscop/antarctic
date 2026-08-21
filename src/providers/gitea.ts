import { CodeChallengeMethod, OAuth2Client } from "../client.js";
import { joinURIAndPath } from "../request.js";
import {
	consumeOAuthState,
	fetchUserProfile,
	generateOAuthCodeVerifier,
	generateOAuthState,
	InvalidOAuthCallbackError,
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

const envPrefix = "GITEA";
const defaultScopes = ["read:user"];

export interface GiteaOptions extends ProviderOptions {
	baseURL?: string;
}

export class Gitea {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private baseURL: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: GiteaOptions);
	constructor(baseURL: string, clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		baseURLOrOptions: string | GiteaOptions,
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
		this.authorizationEndpoint = joinURIAndPath(this.baseURL, "/login/oauth/authorize");
		this.tokenEndpoint = joinURIAndPath(this.baseURL, "/login/oauth/access_token");
	}

	public createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]): URL {
		const url = this.client.createAuthorizationURLWithPKCE(
			this.authorizationEndpoint,
			state,
			CodeChallengeMethod.S256,
			codeVerifier,
			scopes
		);
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string
	): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(
			this.tokenEndpoint,
			code,
			codeVerifier
		);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(this.tokenEndpoint, refreshToken, []);
		return tokens;
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = this.createAuthorizationURL(
			state,
			codeVerifier,
			resolveScopes(scopes, auth, defaultScopes)
		);
		await saveOAuthState(auth.store, state, { codeVerifier });
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		const stored = await consumeOAuthState(auth.store, state);
		if (typeof stored.codeVerifier !== "string") {
			throw new InvalidOAuthCallbackError("Missing PKCE code verifier for OAuth state");
		}
		const tokens = await this.validateAuthorizationCode(code, stored.codeVerifier);
		const userEndpoint = joinURIAndPath(this.baseURL, "/api/v1/user");
		const profile = await fetchUserProfile(userEndpoint, tokens.accessToken());
		return {
			id: profileId(profile.id),
			name: profileString(profile.full_name) ?? profileString(profile.login),
			email: profileString(profile.email),
			image: profileString(profile.avatar_url)
		};
	}
}
