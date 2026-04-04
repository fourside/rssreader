import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../index";
import { verifyPassword } from "../password";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  let body: { email: string; password: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
  if (!body.email || !body.password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, password_hash FROM users WHERE email = ?",
  )
    .bind(body.email)
    .first<{ id: string; password_hash: string }>();
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  )
    .bind(token, user.id, expiresAt)
    .run();

  setCookie(c, "session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return c.json({ ok: true });
});

authRoutes.post("/logout", async (c) => {
  const sessionToken = getCookie(c, "session");
  if (sessionToken) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?")
      .bind(sessionToken)
      .run();
  }

  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});
