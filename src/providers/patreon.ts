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

const authorizationEndpoint = "https://www.patreon.com/oauth2/authorize";
const tokenEndpoint = "https://www.patreon.com/api/oauth2/token";
const identityEndpoint = "https://www.patreon.com/api/oauth2/v2/identity";

const envPrefix = "PATREON";
const defaultScopes = ["identity", "identity[email]"];

export interface PatreonOptions extends ProviderOptions {}

export class Patreon {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: PatreonOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | PatreonOptions,
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
		const url = new URL(identityEndpoint);
		url.searchParams.set("fields[user]", "email,full_name,image_url");
		const response = await fetchUserProfile(url, tokens.accessToken());
		const data = response.data;
		if (typeof data !== "object" || data === null) {
			throw new OAuthProviderError("Unexpected user profile response body");
		}
		const user = data as Record<string, unknown>;
		const attributes = (
			typeof user.attributes === "object" && user.attributes !== null ? user.attributes : {}
		) as Record<string, unknown>;
		return {
			id: profileId(user.id),
			name: profileString(attributes.full_name),
			email: profileString(attributes.email),
			image: profileString(attributes.image_url),
			raw: user,
			...extractOAuthTokens(tokens)
		};
	}
}
