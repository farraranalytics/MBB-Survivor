#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function applySchema() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();

    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying schema...');
    await client.query(schema);

    console.log('✅ Schema applied successfully!');
    
    // Test the schema by querying tables
    console.log('Testing schema...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Created tables:', tablesResult.rows.map(row => row.table_name).join(', '));
    
  } catch (err) {
    console.error('Error applying schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applySchema();