import { generateCodeVerifier, generateState } from "./oauth2.js";

import type { OAuth2Tokens } from "./oauth2.js";

export interface OAuthUser {
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	// The provider's own profile payload, untouched.
	raw?: Record<string, unknown>;
	accessToken?: string;
	refreshToken?: string | null;
	scopes?: string[] | null;
}

// Structurally compatible with a polystore instance (https://polystore.dev/).
export interface OAuthStateStore {
	get: (key: string) => Promise<any>;
	set: (key: string, value: any, options?: { expires?: number | string }) => Promise<any>;
	del: (key: string) => Promise<any>;
}

export interface ProviderOptions {
	clientId?: string;
	clientSecret?: string;
	redirectURI?: string;
	scopes?: string[];
	store: OAuthStateStore;
}

export class OAuthConfigurationError extends Error {}

export class InvalidOAuthCallbackError extends Error {}

export class InvalidOAuthStateError extends Error {
	constructor() {
		super("Unknown or expired OAuth state");
	}
}

export class OAuthProviderError extends Error {
	public code: string | null;

	constructor(message: string, code?: string | null) {
		super(message);
		this.code = code ?? null;
	}
}

export interface AuthConfig {
	clientId: string;
	clientSecret: string | null;
	redirectURI: string | null;
	scopes: string[] | null;
	store: OAuthStateStore;
}

function readEnvironment(name: string): string | null {
	const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
		?.env;
	const value = env?.[name];
	if (value === undefined || value === "") {
		return null;
	}
	return value;
}

export function resolveProviderOption(
	explicit: string | undefined,
	envPrefix: string,
	envSuffix: string
): string | null {
	return explicit ?? readEnvironment(`${envPrefix}_${envSuffix}`);
}

export function requireProviderOption(
	explicit: string | undefined,
	envPrefix: string,
	envSuffix: string,
	optionName: string
): string {
	const value = resolveProviderOption(explicit, envPrefix, envSuffix);
	if (value === null) {
		throw new OAuthConfigurationError(
			`Missing '${optionName}': pass it in the constructor options or set ${envPrefix}_${envSuffix}`
		);
	}
	return value;
}

export function resolveAuthConfig(
	envPrefix: string,
	options: ProviderOptions,
	requirements: { clientSecret?: boolean; redirectURI?: boolean }
): AuthConfig {
	const clientId = requireProviderOption(options.clientId, envPrefix, "CLIENT_ID", "clientId");
	let clientSecret: string | null;
	if (requirements.clientSecret === true) {
		clientSecret = requireProviderOption(
			options.clientSecret,
			envPrefix,
			"CLIENT_SECRET",
			"clientSecret"
		);
	} else {
		clientSecret = resolveProviderOption(options.clientSecret, envPrefix, "CLIENT_SECRET");
	}
	let redirectURI: string | null;
	if (requirements.redirectURI === true) {
		redirectURI = requireProviderOption(
			options.redirectURI,
			envPrefix,
			"REDIRECT_URI",
			"redirectURI"
		);
	} else {
		redirectURI = resolveProviderOption(options.redirectURI, envPrefix, "REDIRECT_URI");
	}
	let scopes: string[] | null = options.scopes ?? null;
	if (scopes === null) {
		const envScopes = readEnvironment(`${envPrefix}_SCOPES`);
		if (envScopes !== null) {
			scopes = envScopes.split(/[\s,]+/).filter((scope) => scope !== "");
		}
	}
	if (options.store === undefined) {
		throw new OAuthConfigurationError("Missing 'store': pass a polystore-compatible store");
	}
	return {
		clientId,
		clientSecret,
		redirectURI,
		scopes,
		store: options.store
	};
}

export function requireAuthConfig(auth: AuthConfig | null): AuthConfig {
	if (auth === null) {
		throw new OAuthConfigurationError(
			"getAuthorizationURL() and getUser() require the options constructor with a 'store'"
		);
	}
	return auth;
}

export function resolveScopes(
	argument: string[] | undefined,
	auth: AuthConfig,
	defaultScopes: string[]
): string[] {
	return argument ?? auth.scopes ?? defaultScopes;
}

const stateKeyPrefix = "arctic:state:";
const stateExpiresSeconds = 60 * 10;

export interface StoredOAuthState {
	codeVerifier?: string;
	nonce?: string;
	// Only for providers that also need the scopes when exchanging the code.
	scopes?: string[];
}

export async function saveOAuthState(
	store: OAuthStateStore,
	state: string,
	payload: StoredOAuthState
): Promise<void> {
	await store.set(stateKeyPrefix + state, payload, { expires: stateExpiresSeconds });
}

export async function consumeOAuthState(
	store: OAuthStateStore,
	state: string
): Promise<StoredOAuthState> {
	const key = stateKeyPrefix + state;
	const payload: unknown = await store.get(key);
	if (typeof payload !== "object" || payload === null) {
		throw new InvalidOAuthStateError();
	}
	await store.del(key);
	return payload as StoredOAuthState;
}

export interface AuthorizationRequest {
	url: URL;
	state: string;
	payload: StoredOAuthState;
}

export interface SavedOAuthState {
	state: string;
	payload?: StoredOAuthState;
}

// With `saved` the caller kept the state itself, so comparing it against the
// value the provider echoed back is the CSRF check. Otherwise the store is.
export async function resolveOAuthState(
	store: OAuthStateStore,
	state: string,
	saved?: SavedOAuthState
): Promise<StoredOAuthState> {
	if (saved !== undefined) {
		if (saved.state !== state) {
			throw new InvalidOAuthStateError();
		}
		return saved.payload ?? {};
	}
	return await consumeOAuthState(store, state);
}

// OAuth2Tokens throws on absent fields, and most providers omit the refresh
// token and scopes unless they were asked for.
export function extractOAuthTokens(tokens: OAuth2Tokens): {
	accessToken: string;
	refreshToken: string | null;
	scopes: string[] | null;
} {
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
		scopes: tokens.hasScopes() ? tokens.scopes() : null
	};
}

export type OAuthCallbackQuery =
	string | URL | URLSearchParams | Record<string, string | string[] | undefined | null>;

export function parseCallbackQuery(query: OAuthCallbackQuery): { code: string; state: string } {
	let params: URLSearchParams;
	if (typeof query === "string") {
		if (query.startsWith("http://") || query.startsWith("https://")) {
			params = new URL(query).searchParams;
		} else {
			params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
		}
	} else if (query instanceof URL) {
		params = query.searchParams;
	} else if (query instanceof URLSearchParams) {
		params = query;
	} else if (typeof query === "object" && query !== null) {
		params = new URLSearchParams();
		for (const [key, value] of Object.entries(query)) {
			if (typeof value === "string") {
				params.set(key, value);
			} else if (Array.isArray(value) && typeof value[0] === "string") {
				params.set(key, value[0]);
			}
		}
	} else {
		throw new InvalidOAuthCallbackError("Invalid callback query");
	}
	const error = params.get("error");
	if (error !== null) {
		const description = params.get("error_description");
		throw new OAuthProviderError(
			`OAuth callback error: ${error}${description !== null ? `: ${description}` : ""}`,
			error
		);
	}
	const code = params.get("code");
	const state = params.get("state");
	if (code === null || code === "" || state === null || state === "") {
		throw new InvalidOAuthCallbackError("Missing 'code' or 'state' in callback query");
	}
	return { code, state };
}

export function generateOAuthState(): string {
	return generateState();
}

export function generateOAuthCodeVerifier(): string {
	return generateCodeVerifier();
}

export async function fetchUserProfile(
	url: string | URL,
	accessToken: string,
	headers?: Record<string, string>
): Promise<Record<string, unknown>> {
	const request = new Request(url, { method: "GET" });
	request.headers.set("Authorization", `Bearer ${accessToken}`);
	request.headers.set("Accept", "application/json");
	request.headers.set("User-Agent", "arctic");
	if (headers !== undefined) {
		for (const [name, value] of Object.entries(headers)) {
			request.headers.set(name, value);
		}
	}
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

export function profileString(value: unknown): string | null {
	if (typeof value === "string" && value !== "") {
		return value;
	}
	return null;
}

export function profileId(value: unknown): string {
	if (typeof value === "string" && value !== "") {
		return value;
	}
	if (typeof value === "number") {
		return value.toString();
	}
	throw new OAuthProviderError("User profile is missing an id");
}
