import { OAuth2Client, CodeChallengeMethod } from "../client.js";
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

const authorizationEndpoint = "https://lichess.org/oauth";
const tokenEndpoint = "https://lichess.org/api/token";
const accountEndpoint = "https://lichess.org/api/account";
const accountEmailEndpoint = "https://lichess.org/api/account/email";

const envPrefix = "LICHESS";
const defaultScopes = ["email:read"];

export interface LichessOptions extends ProviderOptions {}

export class Lichess {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: LichessOptions);
	constructor(clientId: string, redirectURI: string);
	constructor(clientIdOrOptions: string | LichessOptions, redirectURI?: string) {
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
		const profile = await fetchUserProfile(accountEndpoint, accessToken);
		// Requires the email:read scope, so tolerate failure.
		let email: string | null = null;
		try {
			const response = await fetchUserProfile(accountEmailEndpoint, accessToken);
			email = profileString(response.email);
		} catch {
			email = null;
		}
		return {
			id: profileId(profile.id),
			name: profileString(profile.username),
			email,
			image: null,
			raw: profile
		};
	}
}
