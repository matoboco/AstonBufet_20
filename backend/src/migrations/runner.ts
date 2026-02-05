import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, '../../db/migrations');

interface Migration {
  id: number;
  name: string;
  applied_at: Date;
}

export class MigrationRunner {
  private pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
    });
  }

  async init(): Promise<void> {
    // Create migrations tracking table if not exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Migrations table ready');
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await this.pool.query<Migration>(
      'SELECT name FROM _migrations ORDER BY id'
    );
    return result.rows.map((row) => row.name);
  }

  async getPendingMigrations(): Promise<string[]> {
    const applied = await this.getAppliedMigrations();
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !f.includes('.down.'))
      .sort();

    return files.filter((f) => !applied.includes(f));
  }

  async runMigration(filename: string): Promise<void> {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Execute migration SQL
      await client.query(sql);

      // Record migration
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [filename]
      );

      await client.query('COMMIT');
      console.log(`✓ Applied migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runAll(): Promise<number> {
    await this.init();

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('✓ Database is up to date');
      return 0;
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    for (const migration of pending) {
      await this.runMigration(migration);
    }

    return pending.length;
  }

  async status(): Promise<void> {
    await this.init();

    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    console.log('\n=== Migration Status ===');
    console.log(`Applied: ${applied.length}`);
    applied.forEach((m) => console.log(`  ✓ ${m}`));

    console.log(`\nPending: ${pending.length}`);
    pending.forEach((m) => console.log(`  ○ ${m}`));
    console.log('');
  }

  async rollback(steps = 1): Promise<void> {
    const applied = await this.getAppliedMigrations();

    if (applied.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const toRollback = applied.slice(-steps).reverse();

    for (const migration of toRollback) {
      const downFile = migration.replace('.sql', '.down.sql');
      const downPath = path.join(MIGRATIONS_DIR, downFile);

      if (fs.existsSync(downPath)) {
        const sql = fs.readFileSync(downPath, 'utf-8');

        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('DELETE FROM _migrations WHERE name = $1', [migration]);
          await client.query('COMMIT');
          console.log(`✓ Rolled back: ${migration}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } else {
        console.log(`⚠ No rollback file for: ${migration}`);
        await this.pool.query('DELETE FROM _migrations WHERE name = $1', [migration]);
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI
if (require.main === module) {
  const runner = new MigrationRunner();
  const command = process.argv[2] || 'run';

  const run = async () => {
    try {
      switch (command) {
        case 'run':
        case 'up':
          await runner.runAll();
          break;
        case 'status':
          await runner.status();
          break;
        case 'rollback':
        case 'down':
          const steps = parseInt(process.argv[3]) || 1;
          await runner.rollback(steps);
          break;
        default:
          console.log('Usage: ts-node runner.ts [run|status|rollback [steps]]');
      }
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    } finally {
      await runner.close();
    }
  };

  run();
}
