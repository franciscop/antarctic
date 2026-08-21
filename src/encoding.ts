const base64urlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBinaryString(bytes: Uint8Array): string {
	let binary = "";
	// Chunked to stay well under the argument limit for large inputs.
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return binary;
}

export function encodeBase64(bytes: Uint8Array): string {
	return btoa(encodeBinaryString(bytes));
}

export function encodeBase64urlNoPadding(bytes: Uint8Array): string {
	let result = "";
	for (let i = 0; i < bytes.length; i += 3) {
		let buffer = 0;
		let bits = 0;
		for (let j = 0; j < 3 && i + j < bytes.length; j++) {
			buffer = (buffer << 8) | bytes[i + j]!;
			bits += 8;
		}
		for (let j = 0; j < 4 && bits > 0; j++) {
			bits -= 6;
			const index = bits >= 0 ? (buffer >> bits) & 0x3f : (buffer << -bits) & 0x3f;
			result += base64urlAlphabet[index];
		}
	}
	return result;
}

export function decodeBase64urlIgnorePadding(encoded: string): Uint8Array {
	const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/").replaceAll("=", "");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
