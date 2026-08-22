import { CodeChallengeMethod, OAuth2Client } from "../client.js";
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

const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const userEndpoint = "https://api.spotify.com/v1/me";

const envPrefix = "SPOTIFY";
const defaultScopes = ["user-read-email", "user-read-private"];

export interface SpotifyOptions extends ProviderOptions {}

export class Spotify {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: SpotifyOptions);
	constructor(clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		clientIdOrOptions: string | SpotifyOptions,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { redirectURI: true });
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			this.client = new OAuth2Client(clientIdOrOptions, clientSecret ?? null, redirectURI ?? "");
		}
	}

	public async createAuthorizationURL(
		state: string,
		codeVerifier: string | null,
		scopes: string[]
	): Promise<URL> {
		let url: URL;
		if (codeVerifier !== null) {
			url = await this.client.createAuthorizationURLWithPKCE(
				authorizationEndpoint,
				state,
				CodeChallengeMethod.S256,
				codeVerifier,
				scopes
			);
		} else {
			url = this.client.createAuthorizationURL(authorizationEndpoint, state, scopes);
		}
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string | null
	): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(tokenEndpoint, code, codeVerifier);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(tokenEndpoint, refreshToken, []);
		return tokens;
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
		const profile = await fetchUserProfile(userEndpoint, tokens.accessToken());
		let image: string | null = null;
		if (Array.isArray(profile.images) && profile.images.length > 0) {
			const first = profile.images[0] as Record<string, unknown>;
			image = profileString(first.url);
		}
		return {
			id: profileId(profile.id),
			name: profileString(profile.display_name),
			email: profileString(profile.email),
			image,
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}
