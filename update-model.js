import pg from 'pg';
const { Client } = pg;

// Database connection
const client = new Client({
  connectionString: 'postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable'
});

async function updateModelColumn() {
  try {
    await client.connect();
    console.log('Connected to database');

    // First, let's see what tables exist and their structure
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Available tables:');
    tablesResult.rows.forEach(row => console.log(`- ${row.table_name}`));

    // Look for accounts table and check if model column exists
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ig_accounts' OR table_name = 'igaccounts' OR table_name = 'accounts'
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log('\nColumn structure:');
    columnsResult.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));

    // Add model column to ig_accounts table if it doesn't exist
    try {
      await client.query(`
        ALTER TABLE ig_accounts 
        ADD COLUMN IF NOT EXISTS model VARCHAR(255)
      `);
      console.log('\nAdded model column to ig_accounts table');
    } catch (error) {
      console.log('Error adding model column:', error.message);
    }

    // Check current accounts with gmail
    const gmailAccountsResult = await client.query(`
      SELECT id, instagram_username, email_address, model
      FROM ig_accounts 
      WHERE email_address LIKE '%gmail.com' OR instagram_username LIKE '%gmail%'
    `);
    
    console.log(`\nFound ${gmailAccountsResult.rows.length} Gmail-related accounts:`);
    gmailAccountsResult.rows.forEach(row => {
      console.log(`- ID: ${row.id}, Username: ${row.instagram_username}, Email: ${row.email_address}, Current Model: ${row.model || 'NULL'}`);
    });

    // Update Gmail accounts to have model = 'Dillion'
    const updateResult = await client.query(`
      UPDATE ig_accounts 
      SET model = $1 
      WHERE email_address LIKE '%gmail.com' OR instagram_username LIKE '%gmail%'
    `, ['Dillion']);
    
    console.log(`\nUpdated ${updateResult.rowCount} Gmail accounts to model 'Dillion'`);

    // Show updated results
    const updatedAccountsResult = await client.query(`
      SELECT id, instagram_username, email_address, model
      FROM ig_accounts 
      WHERE model = 'Dillion'
    `);
    
    console.log(`\nAccounts now assigned to model 'Dillion':`);
    updatedAccountsResult.rows.forEach(row => {
      console.log(`- ID: ${row.id}, Username: ${row.instagram_username}, Email: ${row.email_address}, Model: ${row.model}`);
    });

  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

updateModelColumn();