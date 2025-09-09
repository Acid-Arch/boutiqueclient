#!/usr/bin/env node

import { Pool } from 'pg';

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function checkSchema() {
    console.log('🔧 Checking database schema...');
    
    try {
        // Test connection
        const testResult = await pool.query('SELECT 1 as test');
        console.log('✅ Database connected');

        // Get users table schema
        const usersSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 Users table structure:');
        usersSchema.rows.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
        });

        // Check if there are any existing users
        const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
        console.log(`\n👥 Existing users: ${userCount.rows[0].count}`);

        if (userCount.rows[0].count > 0) {
            const users = await pool.query('SELECT id, email, name, role, active FROM users LIMIT 5');
            console.log('\n📋 Existing users:');
            users.rows.forEach(user => {
                console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.name}, Role: ${user.role}, Active: ${user.active}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
        }
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n✅ Database connection closed');
    }
}

checkSchema();