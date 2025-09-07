import pg from 'pg';
const { Client } = pg;

// Database connection
const client = new Client({
  connectionString: 'postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable'
});

async function verifyDillionMapping() {
  try {
    await client.connect();
    console.log('🔍 Verifying Dillion model mapping...\n');

    // Check if model column exists
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ig_accounts' AND column_name = 'model';
    `);
    
    if (columnsResult.rows.length === 0) {
      console.log('❌ Model column does not exist, creating it...');
      await client.query(`
        ALTER TABLE ig_accounts 
        ADD COLUMN IF NOT EXISTS model VARCHAR(255)
      `);
      console.log('✅ Model column created');
    } else {
      console.log('✅ Model column exists');
    }

    // Check current Dillion assignments
    const dillionAccountsResult = await client.query(`
      SELECT id, instagram_username, email_address, model, status
      FROM ig_accounts 
      WHERE model = 'Dillion'
      ORDER BY id
      LIMIT 10;
    `);
    
    console.log(`\n📊 Accounts assigned to Dillion model: ${dillionAccountsResult.rowCount}`);
    
    if (dillionAccountsResult.rowCount > 0) {
      console.log('\n📋 First 10 Dillion accounts:');
      dillionAccountsResult.rows.forEach(row => {
        console.log(`   ID: ${row.id} | @${row.instagram_username} | ${row.email_address} | Status: ${row.status}`);
      });
    }

    // Check total Gmail accounts (should match Dillion assignments)
    const gmailTotalResult = await client.query(`
      SELECT COUNT(*) as total
      FROM ig_accounts 
      WHERE email_address LIKE '%gmail.com' OR instagram_username LIKE '%gmail%';
    `);
    
    console.log(`\n📧 Total Gmail accounts: ${gmailTotalResult.rows[0].total}`);
    
    // Verify all Gmail accounts have Dillion assignment
    const unassignedGmailResult = await client.query(`
      SELECT id, instagram_username, email_address, model
      FROM ig_accounts 
      WHERE (email_address LIKE '%gmail.com' OR instagram_username LIKE '%gmail%')
      AND (model IS NULL OR model != 'Dillion')
      LIMIT 5;
    `);
    
    if (unassignedGmailResult.rowCount > 0) {
      console.log(`\n⚠️  Found ${unassignedGmailResult.rowCount} Gmail accounts NOT assigned to Dillion:`);
      unassignedGmailResult.rows.forEach(row => {
        console.log(`   ID: ${row.id} | @${row.instagram_username} | ${row.email_address} | Model: ${row.model || 'NULL'}`);
      });
      
      // Fix the assignments
      console.log('\n🔧 Fixing Gmail account assignments...');
      const fixResult = await client.query(`
        UPDATE ig_accounts 
        SET model = 'Dillion' 
        WHERE (email_address LIKE '%gmail.com' OR instagram_username LIKE '%gmail%')
        AND (model IS NULL OR model != 'Dillion');
      `);
      console.log(`✅ Fixed ${fixResult.rowCount} Gmail account assignments`);
    } else {
      console.log('\n✅ All Gmail accounts are properly assigned to Dillion model');
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.end();
    console.log('\n🔚 Database connection closed');
  }
}

verifyDillionMapping();