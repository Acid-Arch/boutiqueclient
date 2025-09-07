import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: '5.78.151.248',
  port: 5432,
  database: 'igloginagent',
  user: 'iglogin',
  password: 'boutiquepassword123',
  ssl: false,
  statement_timeout: 30000,
  query_timeout: 30000,
  connectionTimeoutMillis: 30000,
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check users table structure
    const userColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

    console.log('\nUsers table columns:');
    console.log('Column Name\t\tData Type\t\tNullable');
    console.log('------------------------------------------------');
    for (const col of userColumns.rows) {
      console.log(`${col.column_name}\t\t${col.data_type}\t\t${col.is_nullable}`);
    }

    // Check if users table exists and has any data
    const userCount = await client.query(`SELECT COUNT(*) FROM users;`);
    console.log(`\nTotal users in table: ${userCount.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);