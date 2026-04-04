/**
 * Usage:
 *   npx tsx scripts/create-user.ts <email> <password>
 *
 * Outputs the SQL INSERT statement to run with:
 *   wrangler d1 execute rss-reader-db --local --command="<output>"
 */

import { hashPassword } from "../src/api/password";

async function main() {
	const [email, password] = process.argv.slice(2);
	if (!email || !password) {
		console.error("Usage: npx tsx scripts/create-user.ts <email> <password>");
		process.exit(1);
	}

	const id = crypto.randomUUID();
	const passwordHash = await hashPassword(password);
	const sql = `INSERT INTO users (id, email, password_hash) VALUES ('${id}', '${email}', '${passwordHash}');`;

	console.log(sql);
}

main();
