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

    // Check enum types
    const enumTypes = await client.query(`
      SELECT t.typname, e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname LIKE '%provider%' OR t.typname LIKE '%role%'
      ORDER BY t.typname, e.enumsortorder;
    `);

    console.log('\nEnum types and values:');
    let currentType = '';
    for (const row of enumTypes.rows) {
      if (row.typname !== currentType) {
        console.log(`\n${row.typname}:`);
        currentType = row.typname;
      }
      console.log(`  - ${row.enumlabel}`);
    }

    // Check existing users to see what values they use
    const existingUsers = await client.query(`
      SELECT provider, role, COUNT(*) 
      FROM users 
      GROUP BY provider, role
      ORDER BY provider, role;
    `);

    console.log('\nExisting user provider/role combinations:');
    console.log('Provider\t\tRole\t\tCount');
    console.log('----------------------------------------');
    for (const row of existingUsers.rows) {
      console.log(`${row.provider}\t\t${row.role}\t\t${row.count}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);