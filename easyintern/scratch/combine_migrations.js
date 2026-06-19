import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const outputFile = path.resolve(__dirname, '../supabase/combined_migrations.sql');

try {
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  let combinedSql = `-- ========================================================\n`;
  combinedSql += `-- CONSOLIDATED MIGRATIONS FOR EZYINTERN PORTAL\n`;
  combinedSql += `-- ========================================================\n\n`;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    combinedSql += `-- --------------------------------------------------------\n`;
    combinedSql += `-- Migration: ${file}\n`;
    combinedSql += `-- --------------------------------------------------------\n`;
    combinedSql += content;
    combinedSql += `\n\n`;
  }

  fs.writeFileSync(outputFile, combinedSql, 'utf8');
  console.log(`Successfully generated combined migrations at: ${outputFile}`);
} catch (error) {
  console.error('Error combining migrations:', error);
}
