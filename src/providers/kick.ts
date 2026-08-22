import { createOAuth2Request, sendTokenRequest, sendTokenRevocationRequest } from "../request.js";
import { createS256CodeChallenge, type OAuth2Tokens } from "../oauth2.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthCodeVerifier,
	generateOAuthState,
	InvalidOAuthCallbackError,
	OAuthProviderError,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	resolveOAuthState,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type {
	AuthorizationRequest,
	AuthConfig,
	OAuthCallbackQuery,
	OAuthUser,
	ProviderOptions,
	SavedOAuthState
} from "../auth.js";

const authorizationEndpoint = "https://id.kick.com/oauth/authorize";
const tokenEndpoint = "https://id.kick.com/oauth/token";
const tokenRevocationEndpoint = "https://id.kick.com/oauth/revoke";
const userEndpoint = "https://api.kick.com/public/v1/users";

const envPrefix = "KICK";
const defaultScopes = ["user:read"];

export interface KickOptions extends ProviderOptions {}

export class Kick {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: KickOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | KickOptions,
		clientSecret?: string,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			this.clientId = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret ?? "";
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			this.clientId = clientIdOrOptions;
			this.clientSecret = clientSecret ?? "";
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
		body.set("client_secret", this.clientSecret);
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
		body.set("client_secret", this.clientSecret);
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
		// Without user IDs the endpoint returns the authorized user as the only data entry.
		const response = await fetchUserProfile(userEndpoint, tokens.accessToken());
		const entries = response.data;
		if (!Array.isArray(entries) || typeof entries[0] !== "object" || entries[0] === null) {
			throw new OAuthProviderError("Unexpected user profile response body");
		}
		const profile = entries[0] as Record<string, unknown>;
		return {
			id: profileId(profile.user_id),
			name: profileString(profile.name),
			email: profileString(profile.email),
			image: profileString(profile.profile_picture),
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}
