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

const authorizationEndpoint = "https://shikimori.one/oauth/authorize";
const tokenEndpoint = "https://shikimori.one/oauth/token";
const userEndpoint = "https://shikimori.one/api/users/whoami";

const envPrefix = "SHIKIMORI";

export interface ShikimoriOptions extends ProviderOptions {}

export class Shikimori {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: ShikimoriOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | ShikimoriOptions,
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

	public createAuthorizationURL(state: string): URL {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("state", state);
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

	public async getAuthorizationURL(): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state);
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
		let image: string | null = null;
		if (typeof profile.image === "object" && profile.image !== null) {
			image = profileString((profile.image as Record<string, unknown>).x160);
		}
		return {
			id: profileId(profile.id),
			name: profileString(profile.nickname),
			email: null,
			image: image ?? profileString(profile.avatar),
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}
