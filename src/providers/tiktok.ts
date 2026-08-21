import { createS256CodeChallenge } from "../oauth2.js";
import { createOAuth2Request, sendTokenRequest, sendTokenRevocationRequest } from "../request.js";
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

const authorizationEndpoint = "https://www.tiktok.com/v2/auth/authorize";
const tokenEndpoint = "https://open.tiktokapis.com/v2/oauth/token/";
const tokenRevocationEndpoint = "https://open.tiktokapis.com/v2/oauth/revoke/";
const userEndpoint = "https://open.tiktokapis.com/v2/user/info/";

const envPrefix = "TIKTOK";
const defaultScopes = ["user.info.basic"];

export interface TikTokOptions extends ProviderOptions {}

export class TikTok {
	private clientKey: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: TikTokOptions);
	constructor(clientKey: string, clientSecret: string, redirectURI: string);
	constructor(
		clientKeyOrOptions: string | TikTokOptions,
		clientSecret?: string,
		redirectURI?: string
	) {
		if (typeof clientKeyOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientKeyOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			this.clientKey = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret ?? "";
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			this.clientKey = clientKeyOrOptions;
			this.clientSecret = clientSecret ?? "";
			this.redirectURI = redirectURI ?? "";
		}
	}

	public createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]): URL {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_key", this.clientKey);
		url.searchParams.set("state", state);
		const codeChallenge = createS256CodeChallenge(codeVerifier);
		url.searchParams.set("code_challenge_method", "S256");
		url.searchParams.set("code_challenge", codeChallenge);
		if (scopes.length > 0) {
			url.searchParams.set("scope", scopes.join(","));
		}
		url.searchParams.set("redirect_uri", this.redirectURI);
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
		body.set("client_key", this.clientKey);
		body.set("client_secret", this.clientSecret);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "refresh_token");
		body.set("refresh_token", refreshToken);
		body.set("client_key", this.clientKey);
		body.set("client_secret", this.clientSecret);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async revokeToken(token: string): Promise<void> {
		const body = new URLSearchParams();
		body.set("token", token);
		body.set("client_key", this.clientKey);
		body.set("client_secret", this.clientSecret);
		const request = createOAuth2Request(tokenRevocationEndpoint, body);
		await sendTokenRevocationRequest(request);
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = this.createAuthorizationURL(
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
		const url = new URL(userEndpoint);
		url.searchParams.set("fields", "open_id,display_name,avatar_url");
		const profile = await fetchUserProfile(url, tokens.accessToken());
		let user: Record<string, unknown> = {};
		if (typeof profile.data === "object" && profile.data !== null) {
			const inner = (profile.data as Record<string, unknown>).user;
			if (typeof inner === "object" && inner !== null) {
				user = inner as Record<string, unknown>;
			}
		}
		// TikTok does not expose an email address.
		return {
			id: profileId(user.open_id),
			name: profileString(user.display_name),
			email: null,
			image: profileString(user.avatar_url)
		};
	}
}
