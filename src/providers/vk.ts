import { createOAuth2Request, sendTokenRequest } from "../request.js";
import {
	consumeOAuthState,
	fetchUserProfile,
	generateOAuthState,
	OAuthProviderError,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const authorizationEndpoint = "https://oauth.vk.com/authorize";
const tokenEndpoint = "https://oauth.vk.com/access_token";
const userEndpoint = "https://api.vk.com/method/users.get";

const envPrefix = "VK";
const defaultScopes = ["email"];

export interface VKOptions extends ProviderOptions {}

export class VK {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: VKOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(clientIdOrOptions: string | VKOptions, clientSecret?: string, redirectURI?: string) {
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

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state, resolveScopes(scopes, auth, defaultScopes));
		await saveOAuthState(auth.store, state, {});
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await consumeOAuthState(auth.store, state);
		const tokens = await this.validateAuthorizationCode(code);
		const url = new URL(userEndpoint);
		url.searchParams.set("v", "5.199");
		url.searchParams.set("fields", "photo_200");
		const profile = await fetchUserProfile(url, tokens.accessToken());
		const entries = profile.response;
		if (!Array.isArray(entries) || typeof entries[0] !== "object" || entries[0] === null) {
			throw new OAuthProviderError("Unexpected user profile response body");
		}
		const user = entries[0] as Record<string, unknown>;
		const nameParts = [profileString(user.first_name), profileString(user.last_name)].filter(
			(part): part is string => part !== null
		);
		// The email is only returned in the token response, not by the API.
		const email = profileString((tokens.data as Record<string, unknown>).email);
		return {
			id: profileId(user.id),
			name: nameParts.length > 0 ? nameParts.join(" ") : null,
			email,
			image: profileString(user.photo_200)
		};
	}
}
