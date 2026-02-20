/**
 * D1 Database helper functions
 * Replaces pg Pool with Cloudflare D1 bindings
 */

export async function query<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results;
}

export async function queryOne<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.first<T>();
  return result ?? null;
}

/**
 * Execute a batch of prepared statements atomically.
 * D1 batch() is all-or-nothing (transactional).
 */
export async function batch(
  db: D1Database,
  statements: D1PreparedStatement[]
): Promise<D1Result[]> {
  return db.batch(statements);
}
