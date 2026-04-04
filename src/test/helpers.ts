import type { Bindings } from "../api/index";
import { hashPassword } from "../api/password";
import { createTestDb } from "./d1-adapter";

export type TestContext = {
  db: D1Database;
  env: Bindings;
  userId: string;
  sessionToken: string;
};

let cachedHash: string | undefined;
async function getTestPasswordHash(): Promise<string> {
  cachedHash ??= await hashPassword("test-password");
  return cachedHash;
}

export async function setupTest(): Promise<TestContext> {
  const db = createTestDb();

  const env: Bindings = {
    DB: db,
    AI: {} as Bindings["AI"],
    VECTORIZE: {} as Bindings["VECTORIZE"],
    ASSETS: {} as Bindings["ASSETS"],
    API_TOKEN: "test-api-token",
  };

  const userId = crypto.randomUUID();
  const passwordHash = await getTestPasswordHash();
  await db
    .prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(userId, "test@example.com", passwordHash)
    .run();

  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await db
    .prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
    )
    .bind(sessionToken, userId, expiresAt)
    .run();

  return { db, env, userId, sessionToken };
}
