const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const key = await deriveKey(password, salt);
	const hash = await crypto.subtle.exportKey("raw", key);
	return `${encode(salt)}.${encode(new Uint8Array(hash))}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [saltStr, hashStr] = stored.split(".");
	if (!saltStr || !hashStr) return false;
	const salt = decode(saltStr);
	const key = await deriveKey(password, salt);
	const hash = await crypto.subtle.exportKey("raw", key);
	return timingSafeEqual(new Uint8Array(hash), decode(hashStr));
}

async function deriveKey(
	password: string,
	salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		material,
		{ name: "HMAC", hash: "SHA-256", length: KEY_LENGTH * 8 },
		true,
		["sign"],
	);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a[i] ^ b[i];
	}
	return result === 0;
}

function encode(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function decode(str: string): Uint8Array<ArrayBuffer> {
	const binary = atob(str);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}
