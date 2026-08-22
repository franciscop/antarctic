import { createS256CodeChallenge } from "../oauth2.js";
import { createOAuth2Request, sendTokenRequest, sendTokenRevocationRequest } from "../request.js";
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

const authorizationEndpoint = "https://polar.sh/oauth2/authorize";
const tokenEndpoint = "https://api.polar.sh/v1/oauth2/token";
const tokenRevocationEndpoint = "https://api.polar.sh/v1/oauth2/revoke";
const userinfoEndpoint = "https://api.polar.sh/v1/oauth2/userinfo";

const envPrefix = "POLAR";
const defaultScopes = ["openid", "profile", "email"];

export interface PolarOptions extends ProviderOptions {}

// Polar.sh supports HTTP Basic Auth but `client_secret` is set as the default authentication method.
export class Polar {
	private clientId: string;
	private clientSecret: string | null;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: PolarOptions);
	constructor(clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		clientIdOrOptions: string | PolarOptions,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { redirectURI: true });
			this.clientId = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret;
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			this.clientId = clientIdOrOptions;
			this.clientSecret = clientSecret ?? null;
			this.redirectURI = redirectURI ?? "";
		}
	}

	public async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<URL> {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("redirect_uri", this.redirectURI);
		url.searchParams.set("state", state);
		if (scopes.length > 0) {
			url.searchParams.set("scope", scopes.join(" "));
		}
		const codeChallenge = await createS256CodeChallenge(codeVerifier);
		url.searchParams.set("code_challenge", codeChallenge);
		url.searchParams.set("code_challenge_method", "S256");
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string
	): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("code", code);
		body.set("client_id", this.clientId);
		if (this.clientSecret !== null) {
			body.set("client_secret", this.clientSecret);
		}
		body.set("redirect_uri", this.redirectURI);
		body.set("grant_type", "authorization_code");
		body.set("code_verifier", codeVerifier);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("refresh_token", refreshToken);
		body.set("client_id", this.clientId);
		if (this.clientSecret !== null) {
			body.set("client_secret", this.clientSecret);
		}
		body.set("grant_type", "refresh_token");
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async revokeToken(token: string): Promise<void> {
		const body = new URLSearchParams();
		body.set("token", token);
		const request = createOAuth2Request(tokenRevocationEndpoint, body);
		await sendTokenRevocationRequest(request);
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
		const claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name),
			email: profileString(claims.email),
			// Polar's userinfo response has no avatar field.
			image: null,
			raw: claims,
			...extractOAuthTokens(tokens)
		};
	}
}
