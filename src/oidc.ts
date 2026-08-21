import { decodeJWT } from "./jwt.js";

export function decodeIdToken(idToken: string): object {
	try {
		return decodeJWT(idToken);
	} catch (e) {
		throw new Error("Invalid ID token", {
			cause: e
		});
	}
}
