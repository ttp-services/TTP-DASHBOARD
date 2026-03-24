import { readFileSync } from 'fs';
import { query } from './src/db/azureSql.js';

async function runMigration() {
  try {
    const sql = readFileSync('./migrations/create_users_table.sql', 'utf8');
    await query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

runMigration();