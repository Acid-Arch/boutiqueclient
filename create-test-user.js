import bcrypt from 'bcrypt';
import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable';

async function createTestUser() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    // Test credentials
    const email = 'demo@boutiqueclient.com';
    const password = 'demo123!';
    const name = 'Demo User';
    const role = 'CLIENT';

    console.log('Creating test user...');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role:', role);

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️  User already exists. Updating password...');
      
      // Update existing user's password
      const result = await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, name, role',
        [passwordHash, email]
      );
      
      console.log('✅ Updated existing user:', result.rows[0]);
    } else {
      console.log('📝 Creating new user...');
      
      // Create new user
      const result = await pool.query(`
        INSERT INTO users (
          id, email, name, password_hash, role, 
          active, email_verified, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, 
          true, true, NOW(), NOW()
        ) RETURNING id, email, name, role
      `, [
        'demo_user_' + Date.now(),
        email,
        name,
        passwordHash,
        role
      ]);
      
      console.log('✅ Created new user:', result.rows[0]);
    }

    console.log('\n🎉 Test User Credentials:');
    console.log('=========================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role:', role);
    console.log('\nYou can now login at: http://5.78.147.68:5173/login');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await pool.end();
  }
}

createTestUser();