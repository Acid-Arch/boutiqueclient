import pkg from 'pg';
import bcrypt from 'bcryptjs';
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

    // 1. Update some existing accounts to use the new models
    console.log('\n1. Updating accounts with new models...');
    
    // Get some accounts to assign to new models
    const availableAccounts = await client.query(`
      SELECT id, instagram_username, model 
      FROM ig_accounts 
      WHERE model IS NULL OR model IN ('Dillion', 'katie')
      ORDER BY id 
      LIMIT 30;
    `);

    console.log(`Found ${availableAccounts.rows.length} accounts to update`);

    // Distribute accounts among the new models
    const newModels = ['Lauren', 'Harry', 'Amber'];
    let modelIndex = 0;

    for (let i = 0; i < Math.min(availableAccounts.rows.length, 21); i++) {
      const account = availableAccounts.rows[i];
      const model = newModels[modelIndex % 3];
      
      await client.query(`
        UPDATE ig_accounts 
        SET model = $1 
        WHERE id = $2;
      `, [model, account.id]);

      console.log(`Updated account ${account.instagram_username} to model: ${model}`);
      modelIndex++;
    }

    // 2. Create test users for each model
    console.log('\n2. Creating test users...');

    const testUsers = [
      {
        email: 'lauren.test@clientportal.com',
        username: 'lauren_test',
        firstName: 'Lauren',
        lastName: 'Model',
        model: 'Lauren',
        password: 'lauren123!'
      },
      {
        email: 'harry.test@clientportal.com', 
        username: 'harry_test',
        firstName: 'Harry',
        lastName: 'Model',
        model: 'Harry',
        password: 'harry123!'
      },
      {
        email: 'amber.test@clientportal.com',
        username: 'amber_test', 
        firstName: 'Amber',
        lastName: 'Model',
        model: 'Amber',
        password: 'amber123!'
      }
    ];

    for (const testUser of testUsers) {
      // Hash password
      const passwordHash = await bcrypt.hash(testUser.password, 12);

      // Check if user already exists
      const existingUser = await client.query(`
        SELECT id FROM users WHERE email = $1;
      `, [testUser.email]);

      if (existingUser.rows.length > 0) {
        console.log(`User ${testUser.email} already exists, skipping...`);
        continue;
      }

      // Create user
      const newUser = await client.query(`
        INSERT INTO users (
          id, email, password_hash, name, 
          role, active, email_verified, created_at, updated_at, provider, model
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW(), NOW(), 'LOCAL', $7
        ) RETURNING id, email;
      `, [
        testUser.email,
        passwordHash,
        `${testUser.firstName} ${testUser.lastName}`,
        'CLIENT',
        true,
        true,
        testUser.model
      ]);

      const userId = newUser.rows[0].id;
      console.log(`Created user: ${testUser.email} (ID: ${userId})`);

      // Assign some accounts to this user for their model
      const modelAccounts = await client.query(`
        SELECT id, instagram_username 
        FROM ig_accounts 
        WHERE model = $1 AND owner_id IS NULL 
        ORDER BY id 
        LIMIT 3;
      `, [testUser.model]);

      console.log(`Found ${modelAccounts.rows.length} accounts for model ${testUser.model}`);

      for (const account of modelAccounts.rows) {
        await client.query(`
          UPDATE ig_accounts 
          SET owner_id = $1 
          WHERE id = $2;
        `, [userId, account.id]);

        console.log(`  - Assigned account ${account.instagram_username} to ${testUser.firstName}`);
      }
    }

    // 3. Show final statistics
    console.log('\n3. Final statistics:');
    
    const modelStats = await client.query(`
      SELECT model, COUNT(*) as total_accounts,
             COUNT(owner_id) as assigned_accounts,
             COUNT(*) - COUNT(owner_id) as unassigned_accounts
      FROM ig_accounts 
      WHERE model IS NOT NULL 
      GROUP BY model 
      ORDER BY model;
    `);

    console.log('\nModel Statistics:');
    console.log('Model\t\tTotal\tAssigned\tUnassigned');
    console.log('------------------------------------------------');
    for (const stat of modelStats.rows) {
      console.log(`${stat.model}\t\t${stat.total_accounts}\t${stat.assigned_accounts}\t\t${stat.unassigned_accounts}`);
    }

    const userStats = await client.query(`
      SELECT u.name, u.email, u.model, COUNT(ia.id) as account_count
      FROM users u
      LEFT JOIN ig_accounts ia ON ia.owner_id::text = u.id
      WHERE u.email LIKE '%@clientportal.com'
      GROUP BY u.id, u.name, u.email, u.model
      ORDER BY u.name;
    `);

    console.log('\nTest User Accounts:');
    console.log('User\t\t\tEmail\t\t\t\t\tModel\t\tAccounts');
    console.log('------------------------------------------------------------------------');
    for (const user of userStats.rows) {
      console.log(`${user.name}\t\t${user.email}\t${user.model}\t\t${user.account_count}`);
    }

    console.log('\n✅ Setup completed successfully!');
    console.log('\nTest Credentials:');
    for (const user of testUsers) {
      console.log(`${user.firstName}: ${user.email} / ${user.password}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);