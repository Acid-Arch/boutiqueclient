import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const DATABASE_URL = 'postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable';

async function debugAuth() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    const email = 'demo@boutiqueclient.com';
    const password = 'demo123!';
    
    console.log('🔍 Debugging Authentication Issue');
    console.log('=====================================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('');

    // Step 1: Check what columns exist in the users table
    console.log('📊 Step 1: Checking table columns...');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('password', 'password_hash', 'passwordHash')
      ORDER BY column_name
    `);
    
    console.log('Available password columns:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Step 2: Query the user with all possible password field names
    console.log('👤 Step 2: Fetching user data...');
    const userResult = await pool.query(`
      SELECT 
        id, 
        email, 
        name,
        role,
        active,
        email_verified,
        CASE 
          WHEN password_hash IS NOT NULL THEN 'password_hash'
          WHEN password IS NOT NULL THEN 'password'
          ELSE 'no_password_field'
        END as password_field,
        COALESCE(password_hash, password) as actual_password_hash,
        LENGTH(COALESCE(password_hash, password)) as hash_length
      FROM users 
      WHERE email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      console.log('❌ User not found!');
      return;
    }

    const user = userResult.rows[0];
    console.log('User found:');
    console.log('  - ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Name:', user.name);
    console.log('  - Role:', user.role);
    console.log('  - Active:', user.active);
    console.log('  - Email Verified:', user.email_verified);
    console.log('  - Password stored in field:', user.password_field);
    console.log('  - Hash exists:', !!user.actual_password_hash);
    console.log('  - Hash length:', user.hash_length);
    console.log('');

    // Step 3: Test password verification
    if (user.actual_password_hash) {
      console.log('🔑 Step 3: Testing password verification...');
      console.log('Hash starts with:', user.actual_password_hash.substring(0, 7));
      
      try {
        const isValid = await bcrypt.compare(password, user.actual_password_hash);
        console.log('Password verification result:', isValid ? '✅ VALID' : '❌ INVALID');
        
        if (!isValid) {
          console.log('');
          console.log('🔄 Generating new hash for comparison...');
          const newHash = await bcrypt.hash(password, 12);
          console.log('New hash starts with:', newHash.substring(0, 7));
          console.log('');
          console.log('⚠️  Password hash mismatch - the stored hash doesn\'t match the password');
          console.log('This means either:');
          console.log('  1. The password was changed');
          console.log('  2. The hash was created with a different password');
          console.log('  3. The hash is corrupted');
        }
      } catch (error) {
        console.log('❌ Error during password verification:', error.message);
        console.log('This might mean the stored value is not a valid bcrypt hash');
      }
    } else {
      console.log('❌ No password hash found for user!');
    }

    // Step 4: Show the exact query our auth system uses
    console.log('');
    console.log('📝 Step 4: Testing exact authentication query...');
    const authQuery = await pool.query(
      'SELECT id, email, name, password_hash, role, active, email_verified FROM users WHERE email = $1',
      [email]
    );
    
    if (authQuery.rows.length > 0) {
      const authUser = authQuery.rows[0];
      console.log('Query result:');
      console.log('  - password_hash exists:', !!authUser.password_hash);
      console.log('  - password_hash length:', authUser.password_hash ? authUser.password_hash.length : 0);
      
      if (!authUser.password_hash) {
        console.log('');
        console.log('❌ PROBLEM FOUND: password_hash field is NULL or missing!');
        console.log('The authentication query returns no password_hash.');
        console.log('This is why authentication fails.');
      }
    } else {
      console.log('❌ Authentication query returned no results');
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await pool.end();
  }
}

debugAuth();