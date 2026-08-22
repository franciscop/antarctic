import { OAuth2Client } from "../client.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthState,
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

const authorizationEndpoint = "https://bitbucket.org/site/oauth2/authorize";
const tokenEndpoint = "https://bitbucket.org/site/oauth2/access_token";
const userEndpoint = "https://api.bitbucket.org/2.0/user";
const userEmailsEndpoint = "https://api.bitbucket.org/2.0/user/emails";

const envPrefix = "BITBUCKET";

export interface BitbucketOptions extends ProviderOptions {}

export class Bitbucket {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: BitbucketOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | BitbucketOptions,
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

	public async getAuthorizationURL(): Promise<AuthorizationRequest> {
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
		const accessToken = tokens.accessToken();
		const profile = await fetchUserProfile(userEndpoint, accessToken);
		let image: string | null = null;
		if (typeof profile.links === "object" && profile.links !== null) {
			const avatar = (profile.links as Record<string, unknown>).avatar;
			if (typeof avatar === "object" && avatar !== null) {
				image = profileString((avatar as Record<string, unknown>).href);
			}
		}
		return {
			id: profileId(profile.uuid ?? profile.account_id),
			name: profileString(profile.display_name) ?? profileString(profile.username),
			email: await fetchPrimaryEmail(accessToken),
			image,
			raw: profile,
			...extractOAuthTokens(tokens)
		};
	}
}

// Emails are not in the profile and need the "email" scope on the consumer.
async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
	let data: Record<string, unknown>;
	try {
		data = await fetchUserProfile(userEmailsEndpoint, accessToken);
	} catch {
		return null;
	}
	if (!Array.isArray(data.values)) {
		return null;
	}
	const entries = data.values.filter(
		(entry): entry is { email: string; is_primary?: boolean } =>
			typeof entry === "object" && entry !== null && typeof entry.email === "string"
	);
	const primary = entries.find((entry) => entry.is_primary === true);
	return primary?.email ?? entries[0]?.email ?? null;
}
