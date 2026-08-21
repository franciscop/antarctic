import * as vitest from "vitest";

import { createJWTSignatureMessage, decodeJWT, encodeJWT } from "./jwt.js";

// RFC 7519 section 3.1 example token.
const rfcToken =
	"eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

vitest.test("decodeJWT()", () => {
	vitest.expect(decodeJWT(rfcToken)).toStrictEqual({
		iss: "joe",
		exp: 1300819380,
		"http://example.com/is_root": true
	});

	vitest.expect(() => decodeJWT("a.b")).toThrow("Invalid JWT");
	vitest.expect(() => decodeJWT("a.b.c.d")).toThrow("Invalid JWT");
	vitest.expect(() => decodeJWT("")).toThrow("Invalid JWT");
	// Valid base64url, but not JSON.
	vitest.expect(() => decodeJWT("aaa.bbbb.cccc")).toThrow("Invalid JWT: Invalid JSON encoding");
	// Valid JSON, but not an object.
	const notObject = encodeJWT("{}", "42", new Uint8Array());
	vitest.expect(() => decodeJWT(notObject)).toThrow("Invalid JWT: Invalid payload");
});

vitest.test("encodeJWT()", () => {
	const token = encodeJWT('{"alg":"ES256"}', '{"sub":"1234"}', new Uint8Array([1, 2, 3]));
	vitest.expect(token.split(".")).toHaveLength(3);
	vitest.expect(token).not.toContain("=");
	vitest.expect(decodeJWT(token)).toStrictEqual({ sub: "1234" });
});

vitest.test("createJWTSignatureMessage()", () => {
	const header = '{"alg":"ES256"}';
	const payload = '{"sub":"1234"}';
	const message = new TextDecoder().decode(createJWTSignatureMessage(header, payload));
	// The signing input is the first two segments of the resulting token.
	const token = encodeJWT(header, payload, new Uint8Array([9]));
	vitest.expect(message).toBe(token.split(".").slice(0, 2).join("."));
});

vitest.test("handles unicode payloads", () => {
	const payload = JSON.stringify({ name: "Ada Lovelace", city: "Málaga", emoji: "🐧" });
	vitest
		.expect(decodeJWT(encodeJWT("{}", payload, new Uint8Array())))
		.toStrictEqual(JSON.parse(payload));
});
