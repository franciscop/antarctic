import { OAuth2Client, CodeChallengeMethod } from "../client.js";
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

const envPrefix = "MASTODON";
const defaultScopes = ["read:accounts"];

export interface MastodonOptions extends ProviderOptions {
	baseURL?: string;
}

export class Mastodon {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private tokenRevocationEndpoint: string;
	private userEndpoint: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: MastodonOptions);
	constructor(baseURL: string, clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		baseURLOrOptions: string | MastodonOptions,
		clientId?: string,
		clientSecret?: string,
		redirectURI?: string
	) {
		let baseURL: string;
		if (typeof baseURLOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, baseURLOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			baseURL = requireProviderOption(baseURLOrOptions.baseURL, envPrefix, "BASE_URL", "baseURL");
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			baseURL = baseURLOrOptions;
			this.client = new OAuth2Client(clientId ?? "", clientSecret ?? null, redirectURI ?? null);
		}
		this.authorizationEndpoint = joinURIAndPath(baseURL, "/api/v1/oauth/authorize");
		this.tokenEndpoint = joinURIAndPath(baseURL, "/api/v1/oauth/token");
		this.tokenRevocationEndpoint = joinURIAndPath(baseURL, "/api/v1/oauth/revoke");
		this.userEndpoint = joinURIAndPath(baseURL, "/api/v1/accounts/verify_credentials");
	}

	public async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<URL> {
		const url = await this.client.createAuthorizationURLWithPKCE(
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

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(this.tokenRevocationEndpoint, token);
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = await this.createAuthorizationURL(
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
		const profile = await fetchUserProfile(this.userEndpoint, tokens.accessToken());
		return {
			id: profileId(profile.id),
			name: profileString(profile.display_name) ?? profileString(profile.username),
			email: null,
			image: profileString(profile.avatar)
		};
	}
}
