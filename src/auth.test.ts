import * as vitest from "vitest";

import {
	consumeOAuthState,
	InvalidOAuthCallbackError,
	InvalidOAuthStateError,
	OAuthConfigurationError,
	OAuthProviderError,
	parseCallbackQuery,
	resolveAuthConfig,
	saveOAuthState
} from "./auth.js";
import { GitHub } from "./providers/github.js";

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

vitest.test("parseCallbackQuery()", () => {
	const expected = { code: "abc", state: "xyz" };
	vitest.expect(parseCallbackQuery("?code=abc&state=xyz")).toStrictEqual(expected);
	vitest.expect(parseCallbackQuery("code=abc&state=xyz")).toStrictEqual(expected);
	vitest
		.expect(parseCallbackQuery("https://example.com/callback?code=abc&state=xyz"))
		.toStrictEqual(expected);
	vitest
		.expect(parseCallbackQuery(new URL("https://example.com/callback?code=abc&state=xyz")))
		.toStrictEqual(expected);
	vitest
		.expect(parseCallbackQuery(new URLSearchParams({ code: "abc", state: "xyz" })))
		.toStrictEqual(expected);
	vitest.expect(parseCallbackQuery({ code: "abc", state: "xyz" })).toStrictEqual(expected);
	vitest.expect(parseCallbackQuery({ code: ["abc"], state: "xyz" })).toStrictEqual(expected);

	vitest.expect(() => parseCallbackQuery("?code=abc")).toThrow(InvalidOAuthCallbackError);
	vitest.expect(() => parseCallbackQuery("?state=xyz")).toThrow(InvalidOAuthCallbackError);
	vitest.expect(() => parseCallbackQuery({})).toThrow(InvalidOAuthCallbackError);
	vitest
		.expect(() => parseCallbackQuery("?error=access_denied&error_description=denied"))
		.toThrow(OAuthProviderError);
});

vitest.test("resolveAuthConfig()", () => {
	const store = createMemoryStore();
	const config = resolveAuthConfig(
		"AUTHTEST",
		{ clientId: "id", clientSecret: "secret", scopes: ["a", "b"], store },
		{ clientSecret: true }
	);
	vitest.expect(config.clientId).toBe("id");
	vitest.expect(config.clientSecret).toBe("secret");
	vitest.expect(config.redirectURI).toBe(null);
	vitest.expect(config.scopes).toStrictEqual(["a", "b"]);

	vitest
		.expect(() => resolveAuthConfig("AUTHTEST", { store }, { clientSecret: true }))
		.toThrow(OAuthConfigurationError);

	process.env.AUTHTEST_CLIENT_ID = "env-id";
	process.env.AUTHTEST_CLIENT_SECRET = "env-secret";
	process.env.AUTHTEST_REDIRECT_URI = "https://example.com/callback";
	process.env.AUTHTEST_SCOPES = "read:user, user:email";
	try {
		const fromEnv = resolveAuthConfig("AUTHTEST", { store }, { clientSecret: true });
		vitest.expect(fromEnv.clientId).toBe("env-id");
		vitest.expect(fromEnv.clientSecret).toBe("env-secret");
		vitest.expect(fromEnv.redirectURI).toBe("https://example.com/callback");
		vitest.expect(fromEnv.scopes).toStrictEqual(["read:user", "user:email"]);

		const explicitWins = resolveAuthConfig(
			"AUTHTEST",
			{ clientId: "id", scopes: [], store },
			{ clientSecret: true }
		);
		vitest.expect(explicitWins.clientId).toBe("id");
		vitest.expect(explicitWins.scopes).toStrictEqual([]);
	} finally {
		delete process.env.AUTHTEST_CLIENT_ID;
		delete process.env.AUTHTEST_CLIENT_SECRET;
		delete process.env.AUTHTEST_REDIRECT_URI;
		delete process.env.AUTHTEST_SCOPES;
	}
});

vitest.test("saveOAuthState() and consumeOAuthState()", async () => {
	const store = createMemoryStore();
	await saveOAuthState(store, "state123", { codeVerifier: "verifier" });
	const payload = await consumeOAuthState(store, "state123");
	vitest.expect(payload).toStrictEqual({ codeVerifier: "verifier" });
	await vitest.expect(consumeOAuthState(store, "state123")).rejects.toThrow(InvalidOAuthStateError);
	await vitest.expect(consumeOAuthState(store, "unknown")).rejects.toThrow(InvalidOAuthStateError);
});

vitest.test("GitHub.getAuthorizationURL()", async () => {
	const store = createMemoryStore();
	const github = new GitHub({ clientId: "id", clientSecret: "secret", store });
	const url = await github.getAuthorizationURL();
	vitest.expect(url.origin).toBe("https://github.com");
	vitest.expect(url.searchParams.get("client_id")).toBe("id");
	vitest.expect(url.searchParams.get("scope")).toBe("read:user user:email");
	const state = url.searchParams.get("state");
	vitest.expect(state).not.toBe(null);
	vitest.expect(store.data.has(`arctic:state:${state}`)).toBe(true);

	const custom = await github.getAuthorizationURL(["repo"]);
	vitest.expect(custom.searchParams.get("scope")).toBe("repo");
});

vitest.test("GitHub high-level methods require the options constructor", async () => {
	const github = new GitHub("id", "secret", null);
	await vitest.expect(github.getAuthorizationURL()).rejects.toThrow(OAuthConfigurationError);
	await vitest
		.expect(github.getUser("?code=abc&state=xyz"))
		.rejects.toThrow(OAuthConfigurationError);
});

vitest.test("GitHub.getUser()", async () => {
	const store = createMemoryStore();
	const github = new GitHub({ clientId: "id", clientSecret: "secret", store });
	const url = await github.getAuthorizationURL();
	const state = url.searchParams.get("state") ?? "";

	const fetchMock = vitest.vi.fn(async (input: Request | string | URL) => {
		const requestURL = input instanceof Request ? input.url : input.toString();
		if (requestURL.startsWith("https://github.com/login/oauth/access_token")) {
			return Response.json({ access_token: "token", token_type: "bearer" });
		}
		if (requestURL.startsWith("https://api.github.com/user")) {
			return Response.json({
				id: 1,
				login: "octocat",
				name: "The Octocat",
				email: "octocat@github.com",
				avatar_url: "https://avatars.githubusercontent.com/u/1",
				company: "GitHub"
			});
		}
		throw new Error(`Unexpected request: ${requestURL}`);
	});
	vitest.vi.stubGlobal("fetch", fetchMock);
	try {
		const user = await github.getUser(`?code=abc&state=${state}`);
		vitest.expect(user).toStrictEqual({
			id: "1",
			name: "The Octocat",
			email: "octocat@github.com",
			image: "https://avatars.githubusercontent.com/u/1",
			// The untouched /user response, so provider-specific fields survive.
			raw: {
				id: 1,
				login: "octocat",
				name: "The Octocat",
				email: "octocat@github.com",
				avatar_url: "https://avatars.githubusercontent.com/u/1",
				company: "GitHub"
			}
		});
		vitest.expect(user.raw?.company).toBe("GitHub");
		// The state is single use.
		await vitest
			.expect(github.getUser(`?code=abc&state=${state}`))
			.rejects.toThrow(InvalidOAuthStateError);
	} finally {
		vitest.vi.unstubAllGlobals();
	}
});
