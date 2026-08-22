import { createS256CodeChallenge } from "../oauth2.js";
import { createOAuth2Request, sendTokenRequest } from "../request.js";
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

const authorizationEndpoint = "https://auth.mercadolibre.com/authorization";
const tokenEndpoint = "https://api.mercadolibre.com/oauth/token";
const userEndpoint = "https://api.mercadolibre.com/users/me";

const envPrefix = "MERCADO_LIBRE";

export interface MercadoLibreOptions extends ProviderOptions {}

export class MercadoLibre {
	public clientId: string;

	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: MercadoLibreOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | MercadoLibreOptions,
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

	// `scopes` not required since they are defined in the application settings
	public async createAuthorizationURL(state: string, codeVerifier: string): Promise<URL> {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("redirect_uri", this.redirectURI);
		url.searchParams.set("state", state);
		const codeChallenge = await createS256CodeChallenge(codeVerifier);
		url.searchParams.set("code_challenge_method", "S256");
		url.searchParams.set("code_challenge", codeChallenge);
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

	// Scopes are defined in the application settings, so the argument is ignored.
	public async getAuthorizationURL(_scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = await this.createAuthorizationURL(state, codeVerifier);
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
		const firstName = profileString(profile.first_name);
		const lastName = profileString(profile.last_name);
		const fullName = [firstName, lastName].filter((part) => part !== null).join(" ");
		let image: string | null = null;
		if (typeof profile.thumbnail === "object" && profile.thumbnail !== null) {
			image = profileString((profile.thumbnail as Record<string, unknown>).picture_url);
		}
		return {
			id: profileId(profile.id),
			name: fullName !== "" ? fullName : profileString(profile.nickname),
			email: profileString(profile.email),
			image,
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}
