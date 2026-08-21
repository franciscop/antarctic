import { CodeChallengeMethod, OAuth2Client } from "../client.js";
import { joinURIAndPath } from "../request.js";
import { decodeIdToken } from "../oidc.js";
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

const envPrefix = "AUTHENTIK";
const defaultScopes = ["openid", "profile", "email"];

export interface AuthentikOptions extends ProviderOptions {
	baseURL?: string;
}

export class Authentik {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private tokenRevocationEndpoint: string;
	private userinfoEndpoint: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: AuthentikOptions);
	constructor(baseURL: string, clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		baseURLOrOptions: string | AuthentikOptions,
		clientId?: string,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		let baseURL: string;
		if (typeof baseURLOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, baseURLOrOptions, { redirectURI: true });
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
		this.authorizationEndpoint = joinURIAndPath(baseURL, "/application/o/authorize/");
		this.tokenEndpoint = joinURIAndPath(baseURL, "/application/o/token/");
		this.tokenRevocationEndpoint = joinURIAndPath(baseURL, "/application/o/revoke/");
		this.userinfoEndpoint = joinURIAndPath(baseURL, "/application/o/userinfo/");
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

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(this.tokenRevocationEndpoint, token);
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
		let claims: Record<string, unknown>;
		if ("id_token" in (tokens.data as object)) {
			claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
		} else {
			claims = await fetchUserProfile(this.userinfoEndpoint, tokens.accessToken());
		}
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name) ?? profileString(claims.preferred_username),
			email: profileString(claims.email),
			image: profileString(claims.picture)
		};
	}
}
