import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

type AuthIdentity = { kind: "user"; userId: string } | { kind: "apiToken" };

type AuthEnv = AppEnv & { Variables: { identity: AuthIdentity } };

export const auth = createMiddleware<AuthEnv>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		const expected = c.env.API_TOKEN;
		if (expected && timingSafeEqual(token, expected)) {
			c.set("identity", { kind: "apiToken" });
			return next();
		}
	}

	const sessionToken = getCookie(c, "session");
	if (sessionToken) {
		const row = await c.env.DB.prepare(
			"SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
		)
			.bind(sessionToken)
			.first<{ user_id: string }>();
		if (row) {
			c.set("identity", { kind: "user", userId: row.user_id });
			return next();
		}
	}

	return c.json({ error: "Unauthorized" }, 401);
});

function timingSafeEqual(a: string, b: string): boolean {
	const encA = new TextEncoder().encode(a);
	const encB = new TextEncoder().encode(b);
	if (encA.byteLength !== encB.byteLength) return false;
	let result = 0;
	for (let i = 0; i < encA.length; i++) {
		result |= encA[i] ^ encB[i];
	}
	return result === 0;
}
