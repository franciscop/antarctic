import { CodeChallengeMethod, OAuth2Client } from "../client.js";
import { decodeIdToken } from "../oidc.js";
import {
	extractOAuthTokens,
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

const envPrefix = "AUTH0";
const defaultScopes = ["openid", "profile", "email"];

export interface Auth0Options extends ProviderOptions {
	domain?: string;
}

export class Auth0 {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private tokenRevocationEndpoint: string;
	private userinfoEndpoint: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: Auth0Options);
	constructor(domain: string, clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		domainOrOptions: string | Auth0Options,
		clientId?: string,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		let domain: string;
		if (typeof domainOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, domainOrOptions, { redirectURI: true });
			domain = requireProviderOption(domainOrOptions.domain, envPrefix, "DOMAIN", "domain");
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			domain = domainOrOptions;
			this.client = new OAuth2Client(clientId ?? "", clientSecret ?? null, redirectURI ?? null);
		}
		this.authorizationEndpoint = `https://${domain}/authorize`;
		this.tokenEndpoint = `https://${domain}/oauth/token`;
		this.tokenRevocationEndpoint = `https://${domain}/oauth/revoke`;
		this.userinfoEndpoint = `https://${domain}/userinfo`;
	}
	public async createAuthorizationURL(
		state: string,
		codeVerifier: string | null,
		scopes: string[]
	): Promise<URL> {
		let url: URL;
		if (codeVerifier !== null) {
			url = await this.client.createAuthorizationURLWithPKCE(
				this.authorizationEndpoint,
				state,
				CodeChallengeMethod.S256,
				codeVerifier,
				scopes
			);
		} else {
			url = this.client.createAuthorizationURL(this.authorizationEndpoint, state, scopes);
		}
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string | null
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

	public async getAuthorizationURL(scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = await this.createAuthorizationURL(
			state,
			codeVerifier,
			resolveScopes(scopes, auth, defaultScopes)
		);
		const payload = { codeVerifier };
		await saveOAuthState(auth.store, state, payload);
		return { url, state, payload };
	}

	public async getUser(query: OAuthCallbackQuery, saved?: SavedOAuthState): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		const stored = await resolveOAuthState(auth.store, state, saved);
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
			name: profileString(claims.name) ?? profileString(claims.nickname),
			email: profileString(claims.email),
			image: profileString(claims.picture),
			raw: claims,
			...extractOAuthTokens(tokens)
		};
	}
}
