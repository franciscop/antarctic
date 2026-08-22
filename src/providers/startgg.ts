import { createOAuth2Request, sendTokenRequest } from "../request.js";
import {
	consumeOAuthState,
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

const authorizationEndpoint = "https://start.gg/oauth/authorize";
const tokenEndpoint = "https://api.start.gg/oauth/access_token";
const refreshEndpoint = "https://api.start.gg/oauth/refresh";
const graphqlEndpoint = "https://api.start.gg/gql/alpha";

const envPrefix = "START_GG";
const defaultScopes = ["user.identity", "user.email"];

const currentUserQuery = "{ currentUser { id name email images { url } } }";

async function fetchCurrentUser(accessToken: string): Promise<Record<string, unknown>> {
	const request = new Request(graphqlEndpoint, {
		method: "POST",
		body: JSON.stringify({ query: currentUserQuery })
	});
	request.headers.set("Authorization", `Bearer ${accessToken}`);
	request.headers.set("Content-Type", "application/json");
	request.headers.set("Accept", "application/json");
	request.headers.set("User-Agent", "arctic");
	let response: Response;
	try {
		response = await fetch(request);
	} catch {
		throw new OAuthProviderError("Failed to fetch user profile");
	}
	if (!response.ok) {
		if (response.body !== null) {
			await response.body.cancel();
		}
		throw new OAuthProviderError(`User profile request failed with status ${response.status}`);
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new OAuthProviderError("User profile response was not valid JSON");
	}
	if (typeof body !== "object" || body === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	const errors = (body as Record<string, unknown>).errors;
	if (Array.isArray(errors) && errors.length > 0) {
		const first = errors[0] as Record<string, unknown>;
		throw new OAuthProviderError(
			`User profile request failed: ${profileString(first.message) ?? "unknown error"}`
		);
	}
	const data = (body as Record<string, unknown>).data;
	if (typeof data !== "object" || data === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	const currentUser = (data as Record<string, unknown>).currentUser;
	if (typeof currentUser !== "object" || currentUser === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	return currentUser as Record<string, unknown>;
}

export interface StartGGOptions extends ProviderOptions {}

export class StartGG {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: StartGGOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | StartGGOptions,
		clientSecret?: string,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, {
				clientSecret: true,
				redirectURI: true
			});
			this.clientId = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret ?? "";
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			this.clientId = clientIdOrOptions;
			this.clientSecret = clientSecret ?? "";
			this.redirectURI = redirectURI ?? "";
		}
	}

	public createAuthorizationURL(state: string, scopes: string[]): URL {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("state", state);
		if (scopes.length > 0) {
			url.searchParams.set("scope", scopes.join(" "));
		}
		url.searchParams.set("redirect_uri", this.redirectURI);
		return url;
	}

	public async validateAuthorizationCode(code: string, scopes: string[]): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_uri", this.redirectURI);
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		if (scopes.length > 0) {
			body.set("scope", scopes.join(" "));
		}
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string, scopes: string[]): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "refresh_token");
		body.set("refresh_token", refreshToken);
		body.set("redirect_uri", this.redirectURI);
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		if (scopes.length > 0) {
			body.set("scope", scopes.join(" "));
		}
		const request = createOAuth2Request(refreshEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const resolved = resolveScopes(scopes, auth, defaultScopes);
		const url = this.createAuthorizationURL(state, resolved);
		await saveOAuthState(auth.store, state, { scopes: resolved });
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		const stored = await consumeOAuthState(auth.store, state);
		const tokens = await this.validateAuthorizationCode(
			code,
			stored.scopes ?? resolveScopes(undefined, auth, defaultScopes)
		);
		const profile = await fetchCurrentUser(tokens.accessToken());
		let image: string | null = null;
		if (Array.isArray(profile.images) && profile.images.length > 0) {
			const first = profile.images[0] as Record<string, unknown>;
			image = profileString(first.url);
		}
		return {
			id: profileId(profile.id),
			name: profileString(profile.name),
			email: profileString(profile.email),
			image,
			raw: profile
		};
	}
}
