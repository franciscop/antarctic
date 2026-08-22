import { OAuth2Client, CodeChallengeMethod } from "../client.js";
import { decodeIdToken } from "../oidc.js";
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

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const tokenRevocationEndpoint = "https://oauth2.googleapis.com/revoke";
const userinfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";

const envPrefix = "GOOGLE";
const defaultScopes = ["openid", "profile", "email"];

export interface GoogleOptions extends ProviderOptions {}

export class Google {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: GoogleOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | GoogleOptions,
		clientSecret?: string,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			this.client = new OAuth2Client(clientIdOrOptions, clientSecret ?? null, redirectURI ?? null);
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

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(tokenRevocationEndpoint, token);
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
		let claims: Record<string, unknown>;
		if ("id_token" in (tokens.data as object)) {
			claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
		} else {
			claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
		}
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name),
			email: profileString(claims.email),
			image: profileString(claims.picture),
			raw: claims,
			...extractOAuthTokens(tokens)
		};
	}
}
