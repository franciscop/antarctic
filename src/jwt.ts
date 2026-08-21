import { decodeBase64urlIgnorePadding, encodeBase64urlNoPadding } from "./encoding.js";

export function decodeJWT(jwt: string): object {
	const parts = jwt.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid JWT");
	}
	let jsonPayload: string;
	try {
		jsonPayload = new TextDecoder().decode(decodeBase64urlIgnorePadding(parts[1]!));
	} catch {
		throw new Error("Invalid JWT: Invalid base64url encoding");
	}
	let payload: unknown;
	try {
		payload = JSON.parse(jsonPayload);
	} catch {
		throw new Error("Invalid JWT: Invalid JSON encoding");
	}
	if (typeof payload !== "object" || payload === null) {
		throw new Error("Invalid JWT: Invalid payload");
	}
	return payload;
}

export function createJWTSignatureMessage(headerJSON: string, payloadJSON: string): Uint8Array {
	const encoder = new TextEncoder();
	const encodedHeader = encodeBase64urlNoPadding(encoder.encode(headerJSON));
	const encodedPayload = encodeBase64urlNoPadding(encoder.encode(payloadJSON));
	return encoder.encode(encodedHeader + "." + encodedPayload);
}

export function encodeJWT(headerJSON: string, payloadJSON: string, signature: Uint8Array): string {
	const encoder = new TextEncoder();
	const encodedHeader = encodeBase64urlNoPadding(encoder.encode(headerJSON));
	const encodedPayload = encodeBase64urlNoPadding(encoder.encode(payloadJSON));
	const encodedSignature = encodeBase64urlNoPadding(signature);
	return encodedHeader + "." + encodedPayload + "." + encodedSignature;
}
