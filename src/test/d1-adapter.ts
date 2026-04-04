import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createTestDb(): D1Database {
	const db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");

	const migrationPath = resolve(
		import.meta.dirname,
		"../../d1/migrations/0001_initial.sql",
	);
	const sql = readFileSync(migrationPath, "utf-8");

	// node:sqlite doesn't support FTS5, so strip FTS/trigger blocks
	const cleaned = sql
		.replace(/CREATE VIRTUAL TABLE.*?;/gs, "")
		.replace(/CREATE TRIGGER[\s\S]*?END;/g, "");

	const statements = cleaned
		.split(";")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	for (const stmt of statements) {
		db.exec(`${stmt};`);
	}

	return createD1Adapter(db);
}

function createD1Adapter(db: DatabaseSync): D1Database {
	return {
		prepare(sql: string) {
			return createStatement(db, sql);
		},
		batch<T = unknown>(statements: D1PreparedStatement[]) {
			return Promise.resolve(
				statements.map((stmt) => {
					const s = stmt as unknown as { _exec: () => D1Result<T> };
					return s._exec();
				}),
			);
		},
		exec(sql: string) {
			db.exec(sql);
			return Promise.resolve({ count: 0, duration: 0 });
		},
		dump() {
			return Promise.resolve(new ArrayBuffer(0));
		},
		withSession(_token: string) {
			return this;
		},
	};
}

function createStatement(db: DatabaseSync, sql: string): D1PreparedStatement {
	let boundValues: unknown[] = [];

	const exec = (): D1Result => {
		const stmt = db.prepare(sql);
		const isSelect =
			sql.trimStart().toUpperCase().startsWith("SELECT") ||
			sql.trimStart().toUpperCase().startsWith("WITH");

		if (isSelect) {
			const rows = stmt.all(...boundValues) as Record<string, unknown>[];
			return {
				results: rows,
				success: true,
				meta: { duration: 0, changes: 0 } as D1Result["meta"],
			} as D1Result;
		}

		const result = stmt.run(...boundValues);
		return {
			results: [],
			success: true,
			meta: {
				duration: 0,
				changes: result.changes,
				last_row_id: result.lastInsertRowid,
			} as D1Result["meta"],
		} as D1Result;
	};

	const statement: D1PreparedStatement = {
		bind(...values: unknown[]) {
			boundValues = values;
			return statement;
		},
		first<T = Record<string, unknown>>(colName?: string) {
			const result = exec();
			const row = result.results[0] as Record<string, unknown> | undefined;
			if (!row) return Promise.resolve(null as T);
			if (colName) return Promise.resolve(row[colName] as T);
			return Promise.resolve(row as T);
		},
		all<T = Record<string, unknown>>() {
			const result = exec();
			return Promise.resolve(result as D1Result<T>);
		},
		run() {
			const result = exec();
			return Promise.resolve(result);
		},
		raw<T = unknown[]>() {
			const stmt = db.prepare(sql);
			const rows = stmt.all(...boundValues) as Record<string, unknown>[];
			return Promise.resolve(rows.map((row) => Object.values(row)) as T[]);
		},
		_exec: exec,
	} as D1PreparedStatement & { _exec: () => D1Result };

	return statement;
}
