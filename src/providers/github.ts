import {
	ArcticFetchError,
	createOAuth2Request,
	createOAuth2RequestError,
	encodeBasicCredentials,
	UnexpectedErrorResponseBodyError,
	UnexpectedResponseError
} from "../request.js";
import { OAuth2Tokens } from "../oauth2.js";
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

import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const authorizationEndpoint = "https://github.com/login/oauth/authorize";
const tokenEndpoint = "https://github.com/login/oauth/access_token";
const userEndpoint = "https://api.github.com/user";
const userEmailsEndpoint = "https://api.github.com/user/emails";

const envPrefix = "GITHUB";
const defaultScopes = ["read:user", "user:email"];

export interface GitHubOptions extends ProviderOptions {}

export class GitHub {
	private clientId: string;
	private clientSecret: string;
	private redirectURI: string | null;
	private auth: AuthConfig | null = null;

	constructor(options: GitHubOptions);
	constructor(clientId: string, clientSecret: string, redirectURI: string | null);
	constructor(
		clientIdOrOptions: string | GitHubOptions,
		clientSecret?: string,
		redirectURI?: string | null
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { clientSecret: true });
			this.clientId = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret ?? "";
			this.redirectURI = this.auth.redirectURI;
		} else {
			this.clientId = clientIdOrOptions;
			this.clientSecret = clientSecret ?? "";
			this.redirectURI = redirectURI ?? null;
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
		if (this.redirectURI !== null) {
			url.searchParams.set("redirect_uri", this.redirectURI);
		}
		return url;
	}

	public async validateAuthorizationCode(code: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		if (this.redirectURI !== null) {
			body.set("redirect_uri", this.redirectURI);
		}
		const request = createOAuth2Request(tokenEndpoint, body);
		const encodedCredentials = encodeBasicCredentials(this.clientId, this.clientSecret);
		request.headers.set("Authorization", `Basic ${encodedCredentials}`);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "refresh_token");
		body.set("refresh_token", refreshToken);
		const request = createOAuth2Request(tokenEndpoint, body);
		const encodedCredentials = encodeBasicCredentials(this.clientId, this.clientSecret);
		request.headers.set("Authorization", `Basic ${encodedCredentials}`);
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
		const accessToken = tokens.accessToken();
		const profile = await fetchUserProfile(userEndpoint, accessToken);
		let email = profileString(profile.email);
		if (email === null) {
			email = await fetchPrimaryEmail(accessToken);
		}
		return {
			id: profileId(profile.id),
			name: profileString(profile.name) ?? profileString(profile.login),
			email,
			image: profileString(profile.avatar_url),
			raw: profile
		};
	}
}

// Private emails are not included in the profile and need the user:email scope.
async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
	let emails: unknown;
	try {
		emails = await fetchUserProfile(userEmailsEndpoint, accessToken);
	} catch {
		return null;
	}
	if (!Array.isArray(emails)) {
		return null;
	}
	const entries = emails.filter(
		(entry): entry is { email: string; primary?: boolean; verified?: boolean } =>
			typeof entry === "object" && entry !== null && typeof entry.email === "string"
	);
	const primary = entries.find((entry) => entry.primary === true);
	return primary?.email ?? entries[0]?.email ?? null;
}

async function sendTokenRequest(request: Request): Promise<OAuth2Tokens> {
	let response: Response;
	try {
		response = await fetch(request);
	} catch (e) {
		throw new ArcticFetchError(e);
	}

	if (response.status !== 200) {
		if (response.body !== null) {
			await response.body.cancel();
		}
		throw new UnexpectedResponseError(response.status);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new UnexpectedResponseError(response.status);
	}
	if (typeof data !== "object" || data === null) {
		throw new UnexpectedErrorResponseBodyError(response.status, data);
	}
	if ("error" in data && typeof data.error === "string") {
		let error: Error;
		try {
			error = createOAuth2RequestError(data);
		} catch {
			throw new UnexpectedErrorResponseBodyError(response.status, data);
		}
		throw error;
	}
	const tokens = new OAuth2Tokens(data);
	return tokens;
}
