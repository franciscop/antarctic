import { CodeChallengeMethod, OAuth2Client } from "../client.js";
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
	resolveProviderOption,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";
import { joinURIAndPath } from "../request.js";

const envPrefix = "OKTA";
const defaultScopes = ["openid", "profile", "email"];

export interface OktaOptions extends ProviderOptions {
	domain?: string;
	authorizationServerId?: string;
}

export class Okta {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private tokenRevocationEndpoint: string;
	private userinfoEndpoint: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: OktaOptions);
	constructor(
		domain: string,
		authorizationServerId: string | null,
		clientId: string,
		clientSecret: string,
		redirectURI: string
	);
	constructor(
		domainOrOptions: string | OktaOptions,
		authorizationServerId?: string | null,
		clientId?: string,
		clientSecret?: string,
		redirectURI?: string
	) {
		let domain: string;
		let serverId: string | null;
		if (typeof domainOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, domainOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			domain = requireProviderOption(domainOrOptions.domain, envPrefix, "DOMAIN", "domain");
			serverId = resolveProviderOption(
				domainOrOptions.authorizationServerId,
				envPrefix,
				"AUTHORIZATION_SERVER_ID"
			);
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			domain = domainOrOptions;
			serverId = authorizationServerId ?? null;
			this.client = new OAuth2Client(clientId ?? "", clientSecret ?? null, redirectURI ?? null);
		}
		let baseURL = `https://${domain}/oauth2`;
		if (serverId !== null) {
			baseURL = joinURIAndPath(baseURL, serverId);
		}
		this.authorizationEndpoint = joinURIAndPath(baseURL, "/v1/authorize");
		this.tokenEndpoint = joinURIAndPath(baseURL, "/v1/token");
		this.tokenRevocationEndpoint = joinURIAndPath(baseURL, "/v1/revoke");
		this.userinfoEndpoint = joinURIAndPath(baseURL, "/v1/userinfo");
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

	public async refreshAccessToken(refreshToken: string, scopes: string[]): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(this.tokenEndpoint, refreshToken, scopes);
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
			name: profileString(claims.name),
			email: profileString(claims.email),
			image: profileString(claims.picture)
		};
	}
}
