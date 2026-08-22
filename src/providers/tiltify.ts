import { createOAuth2Request, sendTokenRequest } from "../request.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthState,
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

const authorizationEndpoint = "https://v5api.tiltify.com/oauth/authorize";
const tokenEndpoint = "https://v5api.tiltify.com/oauth/token";
const userEndpoint = "https://v5api.tiltify.com/api/public/current-user";

const envPrefix = "TILTIFY";
const defaultScopes = ["public"];

export interface TiltifyOptions extends ProviderOptions {}

export class Tiltify {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: TiltifyOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | TiltifyOptions,
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

	public createAuthorizationURL(state: string, scopes: string[]): URL {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("state", state);
		if (scopes.length > 0) {
			url.searchParams.set("scope", scopes.join(" "));
		}
		url.searchParams.set("redirect_uri", this.redirectURI);
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_uri", this.redirectURI);
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "refresh_token");
		body.set("refresh_token", refreshToken);
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state, resolveScopes(scopes, auth, defaultScopes));
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
		let user: Record<string, unknown> = {};
		if (typeof profile.data === "object" && profile.data !== null) {
			user = profile.data as Record<string, unknown>;
		}
		let image: string | null = null;
		if (typeof user.avatar === "object" && user.avatar !== null) {
			image = profileString((user.avatar as Record<string, unknown>).src);
		}
		// Tiltify does not expose an email address on the public current-user endpoint.
		return {
			id: profileId(user.id),
			name: profileString(user.username),
			email: null,
			image,
			raw: user,
			...extractOAuthTokens(tokens)
		};
	}
}
