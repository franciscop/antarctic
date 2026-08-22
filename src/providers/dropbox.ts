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

const authorizationEndpoint = "https://www.dropbox.com/oauth2/authorize";
const tokenEndpoint = "https://api.dropboxapi.com/oauth2/token";
const tokenRevocationEndpoint = "https://api.dropboxapi.com/2/auth/token/revoke";
const userEndpoint = "https://api.dropboxapi.com/2/users/get_current_account";

const envPrefix = "DROPBOX";
const defaultScopes = ["account_info.read"];

export interface DropboxOptions extends ProviderOptions {}

export class Dropbox {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: DropboxOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | DropboxOptions,
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
		const { code, state } = parseCallbackQuery(query);
		await resolveOAuthState(auth.store, state, saved);
		const tokens = await this.validateAuthorizationCode(code);
		const profile = await fetchCurrentAccount(tokens.accessToken());
		let name: string | null = null;
		if (typeof profile.name === "object" && profile.name !== null) {
			name = profileString((profile.name as Record<string, unknown>).display_name);
		}
		return {
			id: profileId(profile.account_id),
			name,
			email: profileString(profile.email),
			image: profileString(profile.profile_photo_url),
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}

// Dropbox requires a POST with no body for the current account endpoint.
async function fetchCurrentAccount(accessToken: string): Promise<Record<string, unknown>> {
	let response: Response;
	try {
		response = await fetch(userEndpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "arctic"
			}
		});
	} catch {
		throw new OAuthProviderError("Failed to fetch user profile");
	}
	if (!response.ok) {
		if (response.body !== null) {
			await response.body.cancel();
		}
		throw new OAuthProviderError(`User profile request failed with status ${response.status}`);
	}
	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new OAuthProviderError("User profile response was not valid JSON");
	}
	if (typeof data !== "object" || data === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	return data as Record<string, unknown>;
}
