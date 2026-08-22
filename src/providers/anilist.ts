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

const authorizationEndpoint = "https://anilist.co/api/v2/oauth/authorize";
const tokenEndpoint = "https://anilist.co/api/v2/oauth/token";
const graphqlEndpoint = "https://graphql.anilist.co";

const envPrefix = "ANI_LIST";

export interface AniListOptions extends ProviderOptions {}

export class AniList {
	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: AniListOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | AniListOptions,
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
		const viewer = await fetchViewer(tokens.accessToken());
		let image: string | null = null;
		if (typeof viewer.avatar === "object" && viewer.avatar !== null) {
			image = profileString((viewer.avatar as Record<string, unknown>).large);
		}
		return {
			id: profileId(viewer.id),
			name: profileString(viewer.name),
			email: null,
			image,
			raw: viewer,
			...extractOAuthTokens(tokens)
		};
	}
}

// AniList only exposes the authenticated user through its GraphQL API.
async function fetchViewer(accessToken: string): Promise<Record<string, unknown>> {
	let response: Response;
	try {
		response = await fetch(graphqlEndpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json",
				"User-Agent": "arctic"
			},
			body: JSON.stringify({ query: "query { Viewer { id name avatar { large } } }" })
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
	const viewer = (data as { data?: { Viewer?: unknown } } | null)?.data?.Viewer;
	if (typeof viewer !== "object" || viewer === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	return viewer as Record<string, unknown>;
}
