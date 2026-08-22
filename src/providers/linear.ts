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

const authorizationEndpoint = "https://linear.app/oauth/authorize";
const tokenEndpoint = "https://api.linear.app/oauth/token";
const graphqlEndpoint = "https://api.linear.app/graphql";

const envPrefix = "LINEAR";
const defaultScopes = ["read"];

export interface LinearOptions extends ProviderOptions {}

export class Linear {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: LinearOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string);
	constructor(
		clientIdOrOptions: string | LinearOptions,
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

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_uri", this.redirectURI);
		body.set("client_id", this.clientId);
		body.set("client_secret", this.clientSecret);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
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
		const viewer = await fetchViewer(tokens.accessToken());
		return {
			id: profileId(viewer.id),
			name: profileString(viewer.name),
			email: profileString(viewer.email),
			image: profileString(viewer.avatarUrl),
			raw: viewer
		};
	}
}

async function fetchViewer(accessToken: string): Promise<Record<string, unknown>> {
	let response: Response;
	try {
		response = await fetch(graphqlEndpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ query: "{ viewer { id name email avatarUrl } }" })
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
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new OAuthProviderError("User profile response was not valid JSON");
	}
	if (typeof body !== "object" || body === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	const data = (body as Record<string, unknown>).data;
	if (typeof data !== "object" || data === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	const viewer = (data as Record<string, unknown>).viewer;
	if (typeof viewer !== "object" || viewer === null) {
		throw new OAuthProviderError("Unexpected user profile response body");
	}
	return viewer as Record<string, unknown>;
}
