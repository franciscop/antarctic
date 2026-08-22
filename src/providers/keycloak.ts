import { CodeChallengeMethod, OAuth2Client } from "../client.js";
import { decodeIdToken } from "../oidc.js";
import {
	extractOAuthTokens,
	fetchUserProfile,
	generateOAuthCodeVerifier,
	generateOAuthState,
	InvalidOAuthCallbackError,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	requireProviderOption,
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

const envPrefix = "KEYCLOAK";
const defaultScopes = ["openid", "profile", "email"];

export interface KeyCloakOptions extends ProviderOptions {
	realmURL?: string;
}

export class KeyCloak {
	private authorizationEndpoint: string;
	private tokenEndpoint: string;
	private tokenRevocationEndpoint: string;
	private userinfoEndpoint: string;

	private client: OAuth2Client;
	private auth: AuthConfig | null = null;

	constructor(options: KeyCloakOptions);
	constructor(realmURL: string, clientId: string, clientSecret: string | null, redirectURI: string);
	constructor(
		realmURLOrOptions: string | KeyCloakOptions,
		clientId?: string,
		clientSecret?: string | null,
		redirectURI?: string
	) {
		let realmURL: string;
		if (typeof realmURLOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, realmURLOrOptions, { redirectURI: true });
			realmURL = requireProviderOption(
				realmURLOrOptions.realmURL,
				envPrefix,
				"REALM_URL",
				"realmURL"
			);
			this.client = new OAuth2Client(
				this.auth.clientId,
				this.auth.clientSecret,
				this.auth.redirectURI
			);
		} else {
			realmURL = realmURLOrOptions;
			this.client = new OAuth2Client(clientId ?? "", clientSecret ?? null, redirectURI ?? null);
		}
		this.authorizationEndpoint = realmURL + "/protocol/openid-connect/auth";
		this.tokenEndpoint = realmURL + "/protocol/openid-connect/token";
		this.tokenRevocationEndpoint = realmURL + "/protocol/openid-connect/revoke";
		this.userinfoEndpoint = realmURL + "/protocol/openid-connect/userinfo";
	}

	public async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<URL> {
		const url = await this.client.createAuthorizationURLWithPKCE(
			this.authorizationEndpoint,
			state,
			CodeChallengeMethod.S256,
			codeVerifier,
			scopes
		);
		return url;
	}

	public async validateAuthorizationCode(
		code: string,
		codeVerifier: string
	): Promise<OAuth2Tokens> {
		const tokens = await this.client.validateAuthorizationCode(
			this.tokenEndpoint,
			code,
			codeVerifier
		);
		return tokens;
	}

	public async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
		const tokens = await this.client.refreshAccessToken(this.tokenEndpoint, refreshToken, []);
		return tokens;
	}

	public async revokeToken(token: string): Promise<void> {
		await this.client.revokeToken(this.tokenRevocationEndpoint, token);
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<AuthorizationRequest> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const codeVerifier = generateOAuthCodeVerifier();
		const url = await this.createAuthorizationURL(
			state,
			codeVerifier,
			resolveScopes(scopes, auth, defaultScopes)
		);
		const payload = { codeVerifier };
		await saveOAuthState(auth.store, state, payload);
		return { url, state, payload };
	}

	public async getUser(query: OAuthCallbackQuery, saved?: SavedOAuthState): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		const stored = await resolveOAuthState(auth.store, state, saved);
		if (typeof stored.codeVerifier !== "string") {
			throw new InvalidOAuthCallbackError("Missing PKCE code verifier for OAuth state");
		}
		const tokens = await this.validateAuthorizationCode(code, stored.codeVerifier);
		let claims: Record<string, unknown>;
		if ("id_token" in (tokens.data as object)) {
			claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
		} else {
			claims = await fetchUserProfile(this.userinfoEndpoint, tokens.accessToken());
		}
		return {
			id: profileId(claims.sub),
			name: profileString(claims.name) ?? profileString(claims.preferred_username),
			email: profileString(claims.email),
			image: profileString(claims.picture),
			raw: claims,
			...extractOAuthTokens(tokens)
		};
	}
}
