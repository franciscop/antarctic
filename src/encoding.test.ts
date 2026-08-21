import * as vitest from "vitest";

import {
	decodeBase64urlIgnorePadding,
	encodeBase64,
	encodeBase64urlNoPadding
} from "./encoding.js";

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

// RFC 4648 section 10 test vectors.
vitest.test("encodeBase64()", () => {
	vitest.expect(encodeBase64(bytes(""))).toBe("");
	vitest.expect(encodeBase64(bytes("f"))).toBe("Zg==");
	vitest.expect(encodeBase64(bytes("fo"))).toBe("Zm8=");
	vitest.expect(encodeBase64(bytes("foo"))).toBe("Zm9v");
	vitest.expect(encodeBase64(bytes("foob"))).toBe("Zm9vYg==");
	vitest.expect(encodeBase64(bytes("fooba"))).toBe("Zm9vYmE=");
	vitest.expect(encodeBase64(bytes("foobar"))).toBe("Zm9vYmFy");
});

vitest.test("encodeBase64urlNoPadding()", () => {
	vitest.expect(encodeBase64urlNoPadding(bytes(""))).toBe("");
	vitest.expect(encodeBase64urlNoPadding(bytes("f"))).toBe("Zg");
	vitest.expect(encodeBase64urlNoPadding(bytes("fo"))).toBe("Zm8");
	vitest.expect(encodeBase64urlNoPadding(bytes("foobar"))).toBe("Zm9vYmFy");
	// The two characters that differ from standard base64.
	vitest.expect(encodeBase64urlNoPadding(new Uint8Array([255, 255, 255]))).toBe("____");
	vitest.expect(encodeBase64urlNoPadding(new Uint8Array([251, 255, 190]))).toBe("-_--");
});

vitest.test("decodeBase64urlIgnorePadding()", () => {
	vitest.expect(Array.from(decodeBase64urlIgnorePadding(""))).toStrictEqual([]);
	vitest.expect(new TextDecoder().decode(decodeBase64urlIgnorePadding("Zm9vYmFy"))).toBe("foobar");
	vitest.expect(new TextDecoder().decode(decodeBase64urlIgnorePadding("Zg"))).toBe("f");
	vitest.expect(new TextDecoder().decode(decodeBase64urlIgnorePadding("Zg=="))).toBe("f");
	vitest.expect(Array.from(decodeBase64urlIgnorePadding("____"))).toStrictEqual([255, 255, 255]);
	vitest.expect(Array.from(decodeBase64urlIgnorePadding("-_--"))).toStrictEqual([251, 255, 190]);
});

vitest.test("round trips arbitrary bytes", () => {
	for (let length = 0; length < 130; length++) {
		const value = new Uint8Array(length);
		crypto.getRandomValues(value);
		const encoded = encodeBase64urlNoPadding(value);
		vitest.expect(encoded).not.toContain("=");
		vitest
			.expect(Array.from(decodeBase64urlIgnorePadding(encoded)))
			.toStrictEqual(Array.from(value));
	}
});
