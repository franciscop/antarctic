import * as vitest from "vitest";

import { createS256CodeChallenge, generateCodeVerifier, generateState } from "./oauth2.js";

vitest.test("createS256CodeChallenge()", async () => {
	// RFC 7636 appendix B.
	vitest
		.expect(await createS256CodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
		.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");

	// SHA-256 of the empty string, base64url without padding.
	vitest
		.expect(await createS256CodeChallenge(""))
		.toBe("47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");

	const challenge = await createS256CodeChallenge(generateCodeVerifier());
	vitest.expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

vitest.test("generateState() and generateCodeVerifier()", () => {
	for (const value of [generateState(), generateCodeVerifier()]) {
		vitest.expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
	}
	vitest.expect(generateState()).not.toBe(generateState());
	vitest.expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
});
