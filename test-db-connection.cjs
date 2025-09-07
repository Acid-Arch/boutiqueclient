#!/usr/bin/env node

const { Client } = require('pg');

// Database configuration from production environment
const dbConfig = {
  host: '5.78.151.248',
  port: 5432,
  database: 'igloginagent',
  user: 'iglogin',
  password: 'boutiquepassword123',
  ssl: {
    rejectUnauthorized: false // Accept self-signed certificates for testing
  },
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
  statement_timeout: 30000
};

async function testDatabaseConnection() {
  const client = new Client(dbConfig);

  try {
    console.log('🔍 Testing database connection...');
    console.log(`Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`Database: ${dbConfig.database}`);
    console.log(`User: ${dbConfig.user}`);
    
    // Connect to database
    console.log('\n📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Test basic query
    console.log('\n🧪 Testing basic query...');
    const result = await client.query('SELECT 1 as test, NOW() as current_time');
    console.log('✅ Basic query successful:', result.rows[0]);

    // Check if main tables exist
    console.log('\n📋 Checking table structure...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`✅ Found ${tables.rows.length} tables:`);
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    // Check users table if exists
    try {
      console.log('\n👥 Testing users table access...');
      const userCount = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Users table accessible. Count: ${userCount.rows[0].count}`);
    } catch (error) {
      console.log('⚠️ Users table not accessible or doesn\'t exist:', error.message);
    }

    // Check ig_accounts table if exists
    try {
      console.log('\n📱 Testing ig_accounts table access...');
      const igCount = await client.query('SELECT COUNT(*) as count FROM ig_accounts');
      console.log(`✅ ig_accounts table accessible. Count: ${igCount.rows[0].count}`);
    } catch (error) {
      console.log('⚠️ ig_accounts table not accessible or doesn\'t exist:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    console.error('Details:', {
      code: error.code,
      severity: error.severity,
      detail: error.detail
    });
    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log('\n🔌 Database connection closed.');
    } catch (error) {
      console.error('Error closing connection:', error.message);
    }
  }
}

// Test the connection
testDatabaseConnection()
  .then(() => {
    console.log('\n🎉 Database connection test completed successfully!');
    console.log('✅ Ready for production deployment');
  })
  .catch((error) => {
    console.error('\n💥 Database test failed:', error);
    process.exit(1);
  });