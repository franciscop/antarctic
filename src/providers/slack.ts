import { OAuth2Client } from "../client.js";
import { decodeIdToken } from "../oidc.js";
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

const authorizationEndpoint = "https://slack.com/openid/connect/authorize";
const tokenEndpoint = "https://slack.com/api/openid.connect.token";
const userinfoEndpoint = "https://slack.com/api/openid.connect.userInfo";

const envPrefix = "SLACK";
const defaultScopes = ["openid", "profile", "email"];

export interface SlackOptions extends ProviderOptions {}

export class Slack {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: SlackOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string | null);
	constructor(
		clientIdOrOptions: string | SlackOptions,
		clientSecret?: string,
		redirectURI?: string | null
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { clientSecret: true });
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			this.client = new OAuth2Client(clientIdOrOptions, clientSecret ?? "", redirectURI ?? null);
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
		let claims: Record<string, unknown>;
		if ("id_token" in (tokens.data as object)) {
			claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
		} else {
			claims = await fetchUserProfile(userinfoEndpoint, tokens.accessToken());
			// Slack answers with HTTP 200 even when the call failed.
			if (claims.ok === false) {
				throw new OAuthProviderError(
					`User profile request failed: ${profileString(claims.error) ?? "unknown error"}`,
					profileString(claims.error)
				);
			}
		}
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name),
			email: profileString(claims.email),
			image: profileString(claims.picture),
			raw: claims
		};
	}
}
