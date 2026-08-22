import { OAuth2Client } from "../client.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthState,
	OAuthConfigurationError,
	OAuthProviderError,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	resolveOAuthState,
	resolveProviderOption,
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

const authorizationEndpoint = "https://www.bungie.net/en/oauth/authorize";
const tokenEndpoint = "https://www.bungie.net/platform/app/oauth/token";
const userEndpoint = "https://www.bungie.net/platform/User/GetCurrentBungieNetUser/";

const envPrefix = "BUNGIE";
// Bungie access is configured on the app, not requested via scopes.
const defaultScopes: string[] = [];

export interface BungieOptions extends ProviderOptions {
	apiKey?: string;
}

export class Bungie {
	private client: OAuth2Client;
	private apiKey: string | null = null;
	private auth: AuthConfig | null = null;

	constructor(options: BungieOptions);
	constructor(clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		clientIdOrOptions: string | BungieOptions,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { redirectURI: true });
			this.apiKey = resolveProviderOption(clientIdOrOptions.apiKey, envPrefix, "API_KEY");
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

	public async getAuthorizationURL(scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const url = this.createAuthorizationURL(state, resolveScopes(scopes, auth, defaultScopes));
		const payload = {};
		await saveOAuthState(auth.store, state, payload);
		return { url, state, payload };
	}

	public async getUser(query: OAuthCallbackQuery, saved?: SavedOAuthState): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		if (this.apiKey === null) {
			throw new OAuthConfigurationError(
				"Missing 'apiKey': pass it in the constructor options or set BUNGIE_API_KEY"
			);
		}
		const { code, state } = parseCallbackQuery(query);
		await resolveOAuthState(auth.store, state, saved);
		const tokens = await this.validateAuthorizationCode(code);
		const body = await fetchUserProfile(userEndpoint, tokens.accessToken(), {
			"X-API-Key": this.apiKey
		});
		const profile = body.Response;
		if (typeof profile !== "object" || profile === null) {
			throw new OAuthProviderError("Unexpected user profile response body");
		}
		const user = profile as Record<string, unknown>;
		const picturePath = profileString(user.profilePicturePath);
		let image: string | null = null;
		if (picturePath !== null) {
			image = picturePath.startsWith("http")
				? picturePath
				: `https://www.bungie.net${picturePath.startsWith("/") ? "" : "/"}${picturePath}`;
		}
		return {
			id: profileId(user.membershipId),
			name: profileString(user.cachedBungieGlobalDisplayName) ?? profileString(user.displayName),
			email: null,
			image,
			raw: user,
			...extractOAuthTokens(tokens)
		};
	}
}
