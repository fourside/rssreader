import { Hono } from "hono";
import { beforeEach, describe, expect, test } from "vitest";
import type { TestContext } from "../../test/helpers";
import { setupTest } from "../../test/helpers";
import type { AuthEnv } from "../middleware/auth";
import { auth } from "../middleware/auth";
import { authRoutes } from "./auth";

let ctx: TestContext;
let app: Hono<AuthEnv>;

beforeEach(async () => {
	ctx = await setupTest();
	app = new Hono<AuthEnv>();
	app.route("/api/auth", authRoutes);
	app.use("/api/*", auth);
	app.get("/api/me", (c) => c.json({ identity: c.get("identity") }));
});

describe("POST /api/auth/login", () => {
	test("returns session cookie on valid credentials", async () => {
		const res = await app.request(
			"/api/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "test@example.com",
					password: "test-password",
				}),
			},
			ctx.env,
		);

		expect(res.status).toBe(200);
		const setCookie = res.headers.get("Set-Cookie");
		expect(setCookie).toContain("session=");
	});

	test("returns 401 on wrong password", async () => {
		const res = await app.request(
			"/api/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "test@example.com",
					password: "wrong",
				}),
			},
			ctx.env,
		);

		expect(res.status).toBe(401);
	});

	test("returns 401 on unknown email", async () => {
		const res = await app.request(
			"/api/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "nobody@example.com",
					password: "test-password",
				}),
			},
			ctx.env,
		);

		expect(res.status).toBe(401);
	});

	test("returns 400 on missing fields", async () => {
		const res = await app.request(
			"/api/auth/login",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "test@example.com" }),
			},
			ctx.env,
		);

		expect(res.status).toBe(400);
	});
});

describe("POST /api/auth/logout", () => {
	test("clears session", async () => {
		const res = await app.request(
			"/api/auth/logout",
			{
				method: "POST",
				headers: { Cookie: `session=${ctx.sessionToken}` },
			},
			ctx.env,
		);

		expect(res.status).toBe(200);

		const meRes = await app.request(
			"/api/me",
			{ headers: { Cookie: `session=${ctx.sessionToken}` } },
			ctx.env,
		);
		expect(meRes.status).toBe(401);
	});
});

describe("auth middleware", () => {
	test("authenticates with session cookie", async () => {
		const res = await app.request(
			"/api/me",
			{ headers: { Cookie: `session=${ctx.sessionToken}` } },
			ctx.env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { identity: unknown };
		expect(body.identity).toEqual({
			kind: "user",
			userId: ctx.userId,
		});
	});

	test("authenticates with Bearer token", async () => {
		const res = await app.request(
			"/api/me",
			{ headers: { Authorization: "Bearer test-api-token" } },
			ctx.env,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { identity: unknown };
		expect(body.identity).toEqual({ kind: "apiToken" });
	});

	test("rejects invalid session", async () => {
		const res = await app.request(
			"/api/me",
			{ headers: { Cookie: "session=invalid-token" } },
			ctx.env,
		);

		expect(res.status).toBe(401);
	});
});
