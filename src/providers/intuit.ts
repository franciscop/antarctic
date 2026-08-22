import { OAuth2Client } from "../client.js";
import {
	consumeOAuthState,
	fetchUserProfile,
	generateOAuthState,
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

const authorizationEndpoint = "https://appcenter.intuit.com/connect/oauth2";
const tokenEndpoint = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const tokenRevocationEndpoint = "https://developer.API.intuit.com/v2/oauth2/tokens/revoke";
const userinfoEndpoint = "https://accounts.platform.intuit.com/v1/openid_connect/userinfo";

const envPrefix = "INTUIT";
const defaultScopes = ["openid", "profile", "email"];

export interface IntuitOptions extends ProviderOptions {}

export class Intuit {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: IntuitOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | IntuitOptions,
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

	public createAuthorizationURL(state: string, scopes: string[]): URL {
		const url = this.client.createAuthorizationURL(authorizationEndpoint, state, scopes);
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(tokenEndpoint, code, null);
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
		const url = this.createAuthorizationURL(state, resolveScopes(scopes, auth, defaultScopes));
		await saveOAuthState(auth.store, state, {});
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await consumeOAuthState(auth.store, state);
		const tokens = await this.validateAuthorizationCode(code);
		// Intuit id_tokens omit profile claims, so always use the OIDC userinfo endpoint.
		const claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
		const givenName = profileString(claims.givenName);
		const familyName = profileString(claims.familyName);
		let name: string | null = null;
		if (givenName !== null || familyName !== null) {
			name = [givenName, familyName].filter((part) => part !== null).join(" ");
		}
		return {
			id: profileId(claims.sub),
			name,
			email: profileString(claims.email),
			image: null,
			raw: claims
		};
	}
}
