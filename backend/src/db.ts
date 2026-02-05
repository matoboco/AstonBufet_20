import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { MigrationRunner } from './migrations/runner';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async <T = any>(text: string, params?: any[]): Promise<T[]> => {
  const result = await pool.query(text, params);
  return result.rows;
};

export const queryOne = async <T = any>(text: string, params?: any[]): Promise<T | null> => {
  const rows = await query<T>(text, params);
  return rows[0] || null;
};

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

/**
 * Wait for database to be ready (useful for Docker startup)
 */
export const waitForDatabase = async (maxRetries = 30, retryInterval = 1000): Promise<void> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✓ Database connection established');
      return;
    } catch (error) {
      console.log(`Waiting for database... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }
  throw new Error('Could not connect to database after maximum retries');
};

/**
 * Initialize database with migrations
 */
export const initializeDatabase = async (): Promise<void> => {
  console.log('\n=== Database Initialization ===');

  // Wait for database to be ready
  await waitForDatabase();

  // Run migrations
  if (process.env.RUN_MIGRATIONS !== 'false') {
    const runner = new MigrationRunner(process.env.DATABASE_URL);
    try {
      const appliedCount = await runner.runAll();
      if (appliedCount > 0) {
        console.log(`✓ Applied ${appliedCount} migration(s)`);
      }
    } finally {
      await runner.close();
    }
  } else {
    console.log('⚠ Migrations skipped (RUN_MIGRATIONS=false)');
  }

  console.log('=== Database Ready ===\n');
};

export default pool;
