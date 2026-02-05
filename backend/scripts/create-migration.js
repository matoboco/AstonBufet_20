#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

// Get migration name from command line
const name = process.argv[2];

if (!name) {
  console.log('Usage: npm run migrate:create <migration_name>');
  console.log('Example: npm run migrate:create add_categories_table');
  process.exit(1);
}

// Get existing migrations to determine next number
const existing = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql') && !f.includes('.down.'))
  .sort();

let nextNum = 1;
if (existing.length > 0) {
  const lastFile = existing[existing.length - 1];
  const match = lastFile.match(/^(\d+)_/);
  if (match) {
    nextNum = parseInt(match[1]) + 1;
  }
}

const paddedNum = String(nextNum).padStart(3, '0');
const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
const filename = `${paddedNum}_${safeName}`;
const date = new Date().toISOString().split('T')[0];

// Create up migration
const upContent = `-- Migration: ${filename}
-- Description: TODO: Add description
-- Created: ${date}

-- TODO: Add your SQL here
`;

const upPath = path.join(MIGRATIONS_DIR, `${filename}.sql`);
fs.writeFileSync(upPath, upContent);
console.log(`Created: ${filename}.sql`);

// Create down migration
const downContent = `-- Rollback: ${filename}
-- WARNING: Make sure this properly reverts the migration!

-- TODO: Add rollback SQL here
`;

const downPath = path.join(MIGRATIONS_DIR, `${filename}.down.sql`);
fs.writeFileSync(downPath, downContent);
console.log(`Created: ${filename}.down.sql`);

console.log(`\nEdit your migrations at: db/migrations/`);
