import * as vitest from "vitest";

import * as arctic from "./index.js";
import { OAuthConfigurationError } from "./auth.js";

import type { OAuthStateStore } from "./auth.js";

function createMemoryStore(): OAuthStateStore & { data: Map<string, unknown> } {
	const data = new Map<string, unknown>();
	return {
		data,
		get: async (key) => data.get(key) ?? null,
		set: async (key, value): Promise<void> => {
			data.set(key, value);
		},
		del: async (key): Promise<void> => {
			data.delete(key);
		}
	};
}

const providerNames = Object.keys(arctic).filter((name) => {
	const value = (arctic as Record<string, unknown>)[name];
	return typeof value === "function" && /^[A-Z]/.test(name) && !name.endsWith("Error");
});

const nonProviders = new Set(["OAuth2Client", "OAuth2Tokens"]);

// Synology publishes no verifiable user profile endpoint, so it stays low-level only.
const withoutHighLevelAPI = new Set(["Synology"]);

vitest.test("every provider exposes the high-level API", () => {
	const providers = providerNames.filter(
		(name) => !nonProviders.has(name) && !withoutHighLevelAPI.has(name)
	);
	vitest.expect(providers.length).toBeGreaterThan(60);
	for (const name of providers) {
		const Provider = (arctic as Record<string, unknown>)[name] as {
			prototype: Record<string, unknown>;
		};
		vitest
			.expect(typeof Provider.prototype.getAuthorizationURL, `${name}.getAuthorizationURL`)
			.toBe("function");
		vitest.expect(typeof Provider.prototype.getUser, `${name}.getUser`).toBe("function");
	}
});

vitest.test("providers preserve the low-level API", async () => {
	const github = new arctic.GitHub("id", "secret", null);
	vitest.expect(typeof github.createAuthorizationURL).toBe("function");
	vitest.expect(typeof github.validateAuthorizationCode).toBe("function");
	vitest.expect(typeof github.refreshAccessToken).toBe("function");

	const url = github.createAuthorizationURL("state", ["user:email"]);
	vitest.expect(url.searchParams.get("state")).toBe("state");
	vitest.expect(url.searchParams.get("scope")).toBe("user:email");

	const google = new arctic.Google("id", "secret", "https://example.com/callback");
	vitest.expect(typeof google.revokeToken).toBe("function");
	// PKCE providers build the URL asynchronously, since SHA-256 is async in the platform.
	const googleURL = await google.createAuthorizationURL("state", "verifier", ["openid"]);
	vitest.expect(googleURL.searchParams.get("code_challenge_method")).toBe("S256");
});

vitest.test("missing configuration throws OAuthConfigurationError", () => {
	const store = createMemoryStore();
	vitest.expect(() => new arctic.GitHub({ store })).toThrow(OAuthConfigurationError);
	vitest
		.expect(() => new arctic.Google({ clientId: "id", store }))
		.toThrow(OAuthConfigurationError);
});

vitest.test("Google.getUser() uses PKCE and the ID token", async () => {
	const store = createMemoryStore();
	const google = new arctic.Google({
		clientId: "id",
		clientSecret: "secret",
		redirectURI: "https://example.com/callback",
		store
	});

	const { url, state, payload } = await google.getAuthorizationURL();
	vitest.expect(url.searchParams.get("code_challenge_method")).toBe("S256");
	vitest.expect(url.searchParams.get("scope")).toBe("openid profile email");

	// PKCE providers hand the verifier back so the caller can persist it.
	const stored = store.data.get(`arctic:state:${state}`) as { codeVerifier?: string };
	vitest.expect(typeof stored.codeVerifier).toBe("string");
	vitest.expect(payload.codeVerifier).toBe(stored.codeVerifier);

	// A JWT with the claims Google returns; the signature is never verified here.
	const claims = {
		sub: "12345",
		name: "Ada Lovelace",
		email: "ada@example.com",
		picture: "https://example.com/ada.jpg",
		hd: "example.com"
	};
	const encode = (value: object): string =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const idToken = `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;

	let sentBody = "";
	const fetchMock = vitest.vi.fn(async (input: Request) => {
		sentBody = await input.text();
		return Response.json({
			access_token: "token",
			token_type: "Bearer",
			id_token: idToken,
			scope: "openid profile email"
		});
	});
	vitest.vi.stubGlobal("fetch", fetchMock);
	try {
		const user = await google.getUser({ code: "abc", state });
		vitest.expect(user).toStrictEqual({
			id: "12345",
			name: "Ada Lovelace",
			email: "ada@example.com",
			image: "https://example.com/ada.jpg",
			// For OIDC providers raw is the decoded ID token claims.
			raw: claims,
			accessToken: "token",
			refreshToken: null,
			scopes: ["openid", "profile", "email"]
		});
		vitest.expect(user.raw?.hd).toBe("example.com");
		vitest.expect(sentBody).toContain(`code_verifier=${stored.codeVerifier}`);
		vitest.expect(store.data.size).toBe(0);
	} finally {
		vitest.vi.unstubAllGlobals();
	}
});

// A runtime loop would need every provider's endpoints mocked, so this reads the
// source instead: it is the check that a newly added provider cannot skip.
vitest.test("every provider's getUser() returns raw and the tokens", async () => {
	const fs = await import("node:fs");
	const dir = new URL("./providers/", import.meta.url);
	const files = fs.readdirSync(dir).filter((name) => name.endsWith(".ts"));
	vitest.expect(files.length).toBe(64);

	const withGetUser = [];
	for (const file of files) {
		const source = fs.readFileSync(new URL(file, dir), "utf8");
		const start = source.indexOf("public async getUser(");
		if (start === -1) {
			// Synology has no user profile endpoint, so it stays low-level only.
			vitest.expect(file, `${file} unexpectedly has no getUser()`).toBe("synology.ts");
			continue;
		}
		withGetUser.push(file);
		const open = source.indexOf("return {", start);
		const block = source.slice(open, source.indexOf("\n\t\t};", open));
		vitest.expect(block, `${file} is missing raw`).toMatch(/\braw:/);
		vitest
			.expect(block, `${file} is missing the tokens`)
			.toContain("...extractOAuthTokens(tokens)");
		vitest
			.expect(source, `${file} does not accept saved state`)
			.toContain("saved?: SavedOAuthState");
		vitest
			.expect(source, `${file} does not return the state and payload`)
			.toContain("return { url, state, payload };");
	}
	vitest.expect(withGetUser.length).toBe(63);
});
