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

const authorizationEndpoint = "https://discord.com/oauth2/authorize";
const tokenEndpoint = "https://discord.com/api/oauth2/token";
const tokenRevocationEndpoint = "https://discord.com/api/oauth2/token/revoke";
const userEndpoint = "https://discord.com/api/users/@me";

const envPrefix = "DISCORD";
const defaultScopes = ["identify", "email"];

export interface DiscordOptions extends ProviderOptions {}

export class Discord {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: DiscordOptions);
	constructor(clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		clientIdOrOptions: string | DiscordOptions,
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
			this.client = new OAuth2Client(clientIdOrOptions, clientSecret ?? null, redirectURI ?? null);
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

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(tokenRevocationEndpoint, token);
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
		const profile = await fetchUserProfile(userEndpoint, tokens.accessToken());
		const id = profileId(profile.id);
		const avatar = profileString(profile.avatar);
		return {
			id,
			name: profileString(profile.global_name) ?? profileString(profile.username),
			email: profileString(profile.email),
			image: avatar === null ? null : `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`,
			raw: profile
		};
	}
}
