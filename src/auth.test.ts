import * as vitest from "vitest";

import {
	InvalidOAuthCallbackError,
	InvalidOAuthStateError,
	OAuthConfigurationError,
	OAuthProviderError,
	parseCallbackQuery,
	resolveAuthConfig,
	resolveOAuthState
} from "./auth.js";
import { GitHub } from "./providers/github.js";

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
	const config = resolveAuthConfig(
		"AUTHTEST",
		{ clientId: "id", clientSecret: "secret", scopes: ["a", "b"] },
		{ clientSecret: true }
	);
	vitest.expect(config.clientId).toBe("id");
	vitest.expect(config.clientSecret).toBe("secret");
	vitest.expect(config.redirectURI).toBe(null);
	vitest.expect(config.scopes).toStrictEqual(["a", "b"]);

	vitest
		.expect(() => resolveAuthConfig("AUTHTEST", {}, { clientSecret: true }))
		.toThrow(OAuthConfigurationError);

	process.env.AUTHTEST_CLIENT_ID = "env-id";
	process.env.AUTHTEST_CLIENT_SECRET = "env-secret";
	process.env.AUTHTEST_REDIRECT_URI = "https://example.com/callback";
	process.env.AUTHTEST_SCOPES = "read:user, user:email";
	try {
		const fromEnv = resolveAuthConfig("AUTHTEST", {}, { clientSecret: true });
		vitest.expect(fromEnv.clientId).toBe("env-id");
		vitest.expect(fromEnv.clientSecret).toBe("env-secret");
		vitest.expect(fromEnv.redirectURI).toBe("https://example.com/callback");
		vitest.expect(fromEnv.scopes).toStrictEqual(["read:user", "user:email"]);

		const explicitWins = resolveAuthConfig(
			"AUTHTEST",
			{ clientId: "id", scopes: [] },
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

vitest.test("resolveOAuthState()", () => {
	const saved = { state: "state123", payload: { codeVerifier: "verifier" } };
	vitest.expect(resolveOAuthState("state123", saved)).toStrictEqual({ codeVerifier: "verifier" });
	vitest.expect(resolveOAuthState("state123", { state: "state123" })).toStrictEqual({});
	vitest.expect(() => resolveOAuthState("other", saved)).toThrow(InvalidOAuthStateError);
});

vitest.test("GitHub.getAuthorizationURL()", async () => {
	const github = new GitHub({ clientId: "id", clientSecret: "secret" });
	const { url, state, payload } = await github.getAuthorizationURL();
	vitest.expect(url.origin).toBe("https://github.com");
	vitest.expect(url.searchParams.get("client_id")).toBe("id");
	vitest.expect(url.searchParams.get("scope")).toBe("read:user user:email");
	vitest.expect(url.searchParams.get("state")).toBe(state);
	// GitHub does not use PKCE, so there is nothing to carry.
	vitest.expect(payload).toStrictEqual({});

	const custom = await github.getAuthorizationURL(["repo"]);
	vitest.expect(custom.url.searchParams.get("scope")).toBe("repo");
});

vitest.test("GitHub high-level methods require the options constructor", async () => {
	const github = new GitHub("id", "secret", null);
	await vitest.expect(github.getAuthorizationURL()).rejects.toThrow(OAuthConfigurationError);
	await vitest
		.expect(github.getUser("?code=abc&state=xyz", { state: "xyz" }))
		.rejects.toThrow(OAuthConfigurationError);
});

vitest.test("GitHub.getUser()", async () => {
	const github = new GitHub({ clientId: "id", clientSecret: "secret" });
	const { state, payload } = await github.getAuthorizationURL();

	let tokenResponse: Record<string, unknown> = { access_token: "token", token_type: "bearer" };
	const fetchMock = vitest.vi.fn(async (input: Request | string | URL) => {
		const requestURL = input instanceof Request ? input.url : input.toString();
		if (requestURL.startsWith("https://github.com/login/oauth/access_token")) {
			return Response.json(tokenResponse);
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
		const user = await github.getUser(`?code=abc&state=${state}`, { state, payload });
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
			},
			accessToken: "token",
			// The provider returned neither, so these are null rather than throwing.
			refreshToken: null,
			scopes: null
		});
		vitest.expect(user.raw?.company).toBe("GitHub");

		const second = await github.getAuthorizationURL();
		const saved = { state: second.state, payload: second.payload };
		tokenResponse = {
			access_token: "token",
			token_type: "bearer",
			refresh_token: "refresh",
			scope: "read:user user:email"
		};
		const viaSaved = await github.getUser(`?code=abc&state=${second.state}`, saved);
		vitest.expect(viaSaved.id).toBe("1");
		vitest.expect(viaSaved.accessToken).toBe("token");
		vitest.expect(viaSaved.refreshToken).toBe("refresh");
		vitest.expect(viaSaved.scopes).toStrictEqual(["read:user", "user:email"]);

		// A state the provider did not echo back is the CSRF failure.
		await vitest
			.expect(
				github.getUser(`?code=abc&state=${second.state}`, {
					state: "mismatch",
					payload: saved.payload
				})
			)
			.rejects.toThrow(InvalidOAuthStateError);
	} finally {
		vitest.vi.unstubAllGlobals();
	}
});
