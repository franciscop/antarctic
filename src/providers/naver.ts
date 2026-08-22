import { createOAuth2Request, sendTokenRequest } from "../request.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthState,
	OAuthProviderError,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	resolveOAuthState,
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

const authorizationEndpoint = "https://nid.naver.com/oauth2.0/authorize";
const tokenEndpoint = "https://nid.naver.com/oauth2.0/token";
const userEndpoint = "https://openapi.naver.com/v1/nid/me";

const envPrefix = "NAVER";

export interface NaverOptions extends ProviderOptions {}

export class Naver {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: NaverOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | NaverOptions,
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

	public createAuthorizationURL(): URL {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("redirect_uri", this.redirectURI);
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		body.set("code", code);
		body.set("redirect_uri", this.redirectURI);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "refresh_token");
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		body.set("refresh_token", refreshToken);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	// Naver scopes are configured in the application settings, so the argument is ignored.
	public async getAuthorizationURL(_scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL();
		url.searchParams.set("state", state);
		const payload = {};
		await saveOAuthState(auth.store, state, payload);
		return { url, state, payload };
	}

	public async getUser(query: OAuthCallbackQuery, saved?: SavedOAuthState): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await resolveOAuthState(auth.store, state, saved);
		const tokens = await this.validateAuthorizationCode(code);
		const profile = await fetchUserProfile(userEndpoint, tokens.accessToken());
		const response = profile.response;
		if (typeof response !== "object" || response === null) {
			throw new OAuthProviderError("Unexpected user profile response body");
		}
		const user = response as Record<string, unknown>;
		return {
			id: profileId(user.id),
			name: profileString(user.name) ?? profileString(user.nickname),
			email: profileString(user.email),
			image: profileString(user.profile_image),
			raw: user,
			...extractOAuthTokens(tokens)
		};
	}
}
