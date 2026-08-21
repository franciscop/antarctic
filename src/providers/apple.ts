import { createJWTSignatureMessage, encodeJWT } from "../jwt.js";

import { createOAuth2Request, sendTokenRequest } from "../request.js";
import { decodeIdToken } from "../oidc.js";
import {
	consumeOAuthState,
	generateOAuthState,
	parseCallbackQuery,
	profileId,
	profileString,
	requireAuthConfig,
	requireProviderOption,
	resolveAuthConfig,
	resolveScopes,
	saveOAuthState
} from "../auth.js";

import type { OAuth2Tokens } from "../oauth2.js";
import type { AuthConfig, OAuthCallbackQuery, OAuthUser, ProviderOptions } from "../auth.js";

const authorizationEndpoint = "https://appleid.apple.com/auth/authorize";
const tokenEndpoint = "https://appleid.apple.com/auth/token";

const envPrefix = "APPLE";
const defaultScopes = ["email"];

export interface AppleOptions extends ProviderOptions {
	teamId?: string;
	keyId?: string;
	pkcs8PrivateKey: Uint8Array;
}

export class Apple {
	private clientId: string;
	private teamId: string;
	private keyId: string;
	private pkcs8PrivateKey: Uint8Array;
	private redirectURI: string;
	private auth: AuthConfig | null = null;

	constructor(options: AppleOptions);
	constructor(
		clientId: string,
		teamId: string,
		keyId: string,
		pkcs8PrivateKey: Uint8Array,
		redirectURI: string
	);
	constructor(
		clientIdOrOptions: string | AppleOptions,
		teamId?: string,
		keyId?: string,
		pkcs8PrivateKey?: Uint8Array,
		redirectURI?: string
	) {
		if (typeof clientIdOrOptions === "object") {
			this.auth = resolveAuthConfig(envPrefix, clientIdOrOptions, { redirectURI: true });
			this.clientId = this.auth.clientId;
			this.teamId = requireProviderOption(clientIdOrOptions.teamId, envPrefix, "TEAM_ID", "teamId");
			this.keyId = requireProviderOption(clientIdOrOptions.keyId, envPrefix, "KEY_ID", "keyId");
			this.pkcs8PrivateKey = clientIdOrOptions.pkcs8PrivateKey;
			this.redirectURI = this.auth.redirectURI ?? "";
		} else {
			this.clientId = clientIdOrOptions;
			this.teamId = teamId ?? "";
			this.keyId = keyId ?? "";
			this.pkcs8PrivateKey = pkcs8PrivateKey ?? new Uint8Array();
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
		const clientSecret = await this.createClientSecret();
		body.set("client_secret", clientSecret);
		const request = createOAuth2Request(tokenEndpoint, body);
		const tokens = await sendTokenRequest(request);
		return tokens;
	}

	public async getAuthorizationURL(scopes?: string[]): Promise<URL> {
		const auth = requireAuthConfig(this.auth);
		const state = generateOAuthState();
		const resolvedScopes = resolveScopes(scopes, auth, defaultScopes);
		const url = this.createAuthorizationURL(state, resolvedScopes);
		// Apple requires form_post whenever scopes are requested.
		if (resolvedScopes.length > 0) {
			url.searchParams.set("response_mode", "form_post");
		}
		await saveOAuthState(auth.store, state, {});
		return url;
	}

	public async getUser(query: OAuthCallbackQuery): Promise<OAuthUser> {
		const auth = requireAuthConfig(this.auth);
		const { code, state } = parseCallbackQuery(query);
		await consumeOAuthState(auth.store, state);
		const tokens = await this.validateAuthorizationCode(code);
		const claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
		return {
			id: profileId(claims.sub),
			name: null,
			email: profileString(claims.email),
			image: null
		};
	}

	private async createClientSecret(): Promise<string> {
		const privateKey = await crypto.subtle.importKey(
			"pkcs8",
			this.pkcs8PrivateKey as Uint8Array<ArrayBuffer>,
			{
				name: "ECDSA",
				namedCurve: "P-256"
			},
			false,
			["sign"]
		);
		const now = Math.floor(Date.now() / 1000);
		const headerJSON = JSON.stringify({
			typ: "JWT",
			alg: "ES256",
			kid: this.keyId
		});
		const payloadJSON = JSON.stringify({
			iss: this.teamId,
			exp: now + 5 * 60,
			aud: ["https://appleid.apple.com"],
			sub: this.clientId,
			iat: now
		});
		const signature = new Uint8Array(
			await crypto.subtle.sign(
				{
					name: "ECDSA",
					hash: "SHA-256"
				},
				privateKey,
				createJWTSignatureMessage(headerJSON, payloadJSON) as Uint8Array<ArrayBuffer>
			)
		);
		const token = encodeJWT(headerJSON, payloadJSON, signature);
		return token;
	}
}
