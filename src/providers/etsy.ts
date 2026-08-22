import { CodeChallengeMethod, OAuth2Client } from "../client.js";
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
	resolveAuthConfig,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const authorizationEndpoint = "https://www.etsy.com/oauth/connect";
const tokenEndpoint = "https://api.etsy.com/v3/public/oauth/token";
const meEndpoint = "https://openapi.etsy.com/v3/application/users/me";
const userEndpoint = "https://openapi.etsy.com/v3/application/users";

const envPrefix = "ETSY";
const defaultScopes = ["email_r"];

export interface EtsyOptions extends ProviderOptions {}

export class Etsy {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: EtsyOptions);
	constructor(clientId: string, redirectURI: string);
	constructor(clientIdOrOptions: string | EtsyOptions, redirectURI?: string) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { redirectURI: true });
			this.client = new OAuth2Client(this.auth.clientId, null, this.auth.redirectURI);
		} else {
			this.client = new OAuth2Client(clientIdOrOptions, null, redirectURI ?? null);
		}
	}

	public async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<URL> {
		const url = await this.client.createAuthorizationURLWithPKCE(
			authorizationEndpoint,
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
		const tokens = await this.client.validateAuthorizationCode(tokenEndpoint, code, codeVerifier);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(tokenEndpoint, refreshToken, []);
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
		const accessToken = tokens.accessToken();
		// Etsy requires the app keystring as an API key header on every request.
		const headers = { "x-api-key": auth.clientId };
		const me = await fetchUserProfile(meEndpoint, accessToken, headers);
		const userId = profileId(me.user_id);
		const profile = await fetchUserProfile(`${userEndpoint}/${userId}`, accessToken, headers);
		const firstName = profileString(profile.first_name);
		const lastName = profileString(profile.last_name);
		let name: string | null = null;
		if (firstName !== null || lastName !== null) {
			name = [firstName, lastName].filter((part) => part !== null).join(" ");
		}
		return {
			id: userId,
			name,
			email: profileString(profile.primary_email),
			image: profileString(profile.image_url_75x75)
		};
	}
}
