/**
 * D1 Database helpers
 * Replaces pg Pool-based queries with Cloudflare D1 bindings
 */

export type D1Database = import('@cloudflare/workers-types').D1Database;

export async function query<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results;
}

export async function queryOne<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.first<T>();
  return result ?? null;
}

export async function run(
  db: D1Database,
  sql: string,
  params: unknown[] = []
): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.run();
}

export interface D1Result {
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
  };
}

/**
 * Execute multiple statements in a batch (D1's transaction equivalent).
 * D1 batches are atomic - all succeed or all fail.
 */
export async function batch(
  db: D1Database,
  statements: { sql: string; params?: unknown[] }[]
): Promise<unknown[]> {
  const prepared = statements.map((s) =>
    db.prepare(s.sql).bind(...(s.params || []))
  );
  return db.batch(prepared);
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
