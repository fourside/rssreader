import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
	test("hashPassword returns salt.hash format", async () => {
		const hash = await hashPassword("test-password");
		const parts = hash.split(".");
		expect(parts).toHaveLength(2);
		expect(parts[0].length).toBeGreaterThan(0);
		expect(parts[1].length).toBeGreaterThan(0);
	});

	test("verifyPassword returns true for correct password", async () => {
		const hash = await hashPassword("my-secret");
		expect(await verifyPassword("my-secret", hash)).toBe(true);
	});

	test("verifyPassword returns false for wrong password", async () => {
		const hash = await hashPassword("my-secret");
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	});

	test("verifyPassword returns false for malformed hash", async () => {
		expect(await verifyPassword("test", "invalid")).toBe(false);
		expect(await verifyPassword("test", "")).toBe(false);
	});

	test("different calls produce different hashes", async () => {
		const hash1 = await hashPassword("same-password");
		const hash2 = await hashPassword("same-password");
		expect(hash1).not.toBe(hash2);
	});
});
