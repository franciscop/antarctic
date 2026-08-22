import { OAuth2Client } from "../client.js";
import {
	extractOAuthTokens,
	generateOAuthState,
	OAuthProviderError,
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

const authorizationEndpoint = "https://api.notion.com/v1/oauth/authorize";
const tokenEndpoint = "https://api.notion.com/v1/oauth/token";

const envPrefix = "NOTION";

export interface NotionOptions extends ProviderOptions {}

export class Notion {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: NotionOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | NotionOptions,
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

	public createAuthorizationURL(state: string): URL {
		const url = this.client.createAuthorizationURL(authorizationEndpoint, state, []);
		url.searchParams.set("owner", "user");
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(tokenEndpoint, code, null);
		return tokens;
	}

	// Notion does not use scopes, so the argument is ignored.
	public async getAuthorizationURL(_scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state);
		const payload = {};
		await saveOAuthState(auth.store, state, payload);
		return { url, state, payload };
	}

	public async getUser(query: OAuthCallbackQuery, saved?: SavedOAuthState): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await resolveOAuthState(auth.store, state, saved);
		const tokens = await this.validateAuthorizationCode(code);
		// Notion returns the authorizing user inside the token response.
		const data = tokens.data as Record<string, unknown>;
		const owner = data.owner;
		if (typeof owner !== "object" || owner === null) {
			throw new OAuthProviderError("Notion token response is missing the owner");
		}
		const user = (owner as Record<string, unknown>).user;
		if (typeof user !== "object" || user === null) {
			throw new OAuthProviderError("Notion token response is missing the user");
		}
		const profile = user as Record<string, unknown>;
		let email: string | null = null;
		if (typeof profile.person === "object" && profile.person !== null) {
			email = profileString((profile.person as Record<string, unknown>).email);
		}
		return {
			id: profileId(profile.id),
			name: profileString(profile.name),
			email,
			image: profileString(profile.avatar_url),
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}
