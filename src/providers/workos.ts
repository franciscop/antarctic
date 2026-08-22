import { createOAuth2Request, sendTokenRequest } from "../request.js";
import {
	consumeOAuthState,
	fetchUserProfile,
	generateOAuthCodeVerifier,
	generateOAuthState,
	InvalidOAuthCallbackError,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	resolveAuthConfig,
	saveOAuthState
} from "../auth.js";

import { createS256CodeChallenge, type OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const authorizationEndpoint = "https://api.workos.com/sso/authorize";
const tokenEndpoint = "https://api.workos.com/sso/token";
const profileEndpoint = "https://api.workos.com/sso/profile";

const envPrefix = "WORKOS";

export interface WorkOSOptions extends ProviderOptions {}

export class WorkOS {
	private clientId: string;
	private clientSecret: string | null;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: WorkOSOptions);
	constructor(clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		clientIdOrOptions: string | WorkOSOptions,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { redirectURI: true });
			this.clientId = this.auth.clientId;
			this.clientSecret = this.auth.clientSecret;
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			this.clientId = clientIdOrOptions;
			this.clientSecret = clientSecret ?? null;
			this.redirectURI = redirectURI ?? "";
		}
	}

	public async createAuthorizationURL(state: string, codeVerifier: string | null): Promise<URL> {
		const url = new URL(authorizationEndpoint);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", this.clientId);
		url.searchParams.set("state", state);
		url.searchParams.set("redirect_uri", this.redirectURI);
		if (codeVerifier !== null) {
			const codeChallenge = await createS256CodeChallenge(codeVerifier);
			url.searchParams.set("code_challenge_method", "S256");
			url.searchParams.set("code_challenge", codeChallenge);
		}
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string | null
	): Promise<OAuth2Tokens> {
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_uri", this.redirectURI);
		body.set("client_id", this.clientId);
		if (this.clientSecret !== null) {
			body.set("client_secret", this.clientSecret);
		}
		if (codeVerifier !== null) {
			body.set("code_verifier", codeVerifier);
		}
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async getAuthorizationURL(): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = await this.createAuthorizationURL(state, codeVerifier);
		await saveOAuthState(auth.store, state, { codeVerifier });
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		const stored = await consumeOAuthState(auth.store, state);
		if (typeof stored.codeVerifier !== "string") {
			throw new InvalidOAuthCallbackError("Missing PKCE code verifier for OAuth state");
		}
		const tokens = await this.validateAuthorizationCode(code, stored.codeVerifier);
		const profile = await fetchUserProfile(profileEndpoint, tokens.accessToken());
		const firstName = profileString(profile.first_name);
		const lastName = profileString(profile.last_name);
		const fullName = [firstName, lastName].filter((part) => part !== null).join(" ");
		return {
			id: profileId(profile.id),
			name: profileString(profile.name) ?? (fullName !== "" ? fullName : null),
			email: profileString(profile.email),
			image: profileString(profile.profile_picture_url),
			raw: profile
		};
	}
}
