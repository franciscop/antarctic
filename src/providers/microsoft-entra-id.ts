import { createS256CodeChallenge } from "../oauth2.js";
import {
	createOAuth2Request,
	encodeBasicCredentials,
	joinURIAndPath,
	sendTokenRequest
} from "../request.js";
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

const userinfoEndpoint = "https://graph.microsoft.com/oidc/userinfo";

const envPrefix = "MICROSOFT_ENTRA_ID";
const defaultScopes = ["openid", "profile", "email"];

export interface MicrosoftEntraIdOptions extends ProviderOptions {
	tenant?: string;
}

export class MicrosoftEntraId {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private clientId: string;
	private clientSecret: string | null;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: MicrosoftEntraIdOptions);
	constructor(tenant: string, clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		tenantOrOptions: string | MicrosoftEntraIdOptions,
		clientId?: string,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		let tenant: string;
		if (typeof tenantOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, tenantOrOptions, { redirectURI: true });
			tenant = requireProviderOption(tenantOrOptions.tenant, envPrefix, "TENANT", "tenant");
			this.clientId = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret;
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			tenant = tenantOrOptions;
			this.clientId = clientId ?? "";
			this.clientSecret = clientSecret ?? null;
			this.redirectURI = redirectURI ?? "";
		}
		this.authorizationEndpoint = joinURIAndPath(
			"https://login.microsoftonline.com",
			tenant,
			"/oauth2/v2.0/authorize"
		);
		this.tokenEndpoint = joinURIAndPath(
			"https://login.microsoftonline.com",
			tenant,
			"/oauth2/v2.0/token"
		);
	}

	public async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<URL> {
		const url = new URL(this.authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("redirect_uri", this.redirectURI);
		url.searchParams.set("state", state);
		const codeChallenge = await createS256CodeChallenge(codeVerifier);
		url.searchParams.set("code_challenge_method", "S256");
		url.searchParams.set("code_challenge", codeChallenge);
		if (scopes.length > 0) {
			url.searchParams.set("scope", scopes.join(" "));
		}
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string
	): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_uri", this.redirectURI);
		body.set("code_verifier", codeVerifier);
		if (this.clientSecret === null) {
			body.set("client_id", this.clientId);
		}
		const request = createOAuth2Request(this.tokenEndpoint, body);
		if (this.clientSecret !== null) {
			const encodedCredentials = encodeBasicCredentials(this.clientId, this.clientSecret);
			request.headers.set("Authorization", `Basic ${encodedCredentials}`);
		} else {
			// Origin header required for public clients. Value can be anything.
			request.headers.set("Origin", "arctic");
		}
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string, scopes: string[]): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "refresh_token");
		body.set("refresh_token", refreshToken);
		if (this.clientSecret === null) {
			body.set("client_id", this.clientId);
		}
		if (scopes.length > 0) {
			body.set("scope", scopes.join(" "));
		}
		const request = createOAuth2Request(this.tokenEndpoint, body);
		if (this.clientSecret !== null) {
			const encodedCredentials = encodeBasicCredentials(this.clientId, this.clientSecret);
			request.headers.set("Authorization", `Basic ${encodedCredentials}`);
		} else {
			// Origin header required for public clients. Value can be anything.
			request.headers.set("Origin", "arctic");
		}
		const tokens = await sendTokenRequest(request);
		return tokens;
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
		let claims: Record<string, unknown>;
		if ("id_token" in (tokens.data as object)) {
			claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
		} else {
			claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
		}
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name),
			email: profileString(claims.email) ?? profileString(claims.preferred_username),
			image: profileString(claims.picture),
			raw: claims
		};
	}
}
