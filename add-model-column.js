import pkg from 'pg';
const { Client } = pkg;

// Use environment variables for database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30',
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS) || 30000,
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check if model column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ig_accounts' 
      AND column_name = 'model';
    `);

    if (checkColumn.rows.length === 0) {
      console.log('Adding model column to ig_accounts table...');
      await client.query(`
        ALTER TABLE ig_accounts 
        ADD COLUMN model VARCHAR(100) NULL;
      `);
      console.log('Model column added successfully');
    } else {
      console.log('Model column already exists');
    }

    // Add index for the model column if it doesn't exist
    const checkIndex = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'ig_accounts' 
      AND indexname = 'idx_ig_accounts_model';
    `);

    if (checkIndex.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_ig_accounts_model ON ig_accounts(model);
      `);
      console.log('Index on model column added');
    }

    // Check current model values
    console.log('\nCurrent unique model values:');
    const models = await client.query(`
      SELECT model, COUNT(*) as count 
      FROM ig_accounts 
      WHERE model IS NOT NULL 
      GROUP BY model 
      ORDER BY count DESC;
    `);
    
    console.log(models.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);