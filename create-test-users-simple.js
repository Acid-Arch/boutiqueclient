#!/usr/bin/env node

import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

const SALT_ROUNDS = 12;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function createTestUsers() {
    console.log('🔧 Creating test users...');
    
    try {
        // Test connection
        const testResult = await pool.query('SELECT 1 as test');
        if (testResult.rows[0]?.test !== 1) {
            throw new Error('Database connection test failed');
        }
        console.log('✅ Database connected');

        // Hash passwords
        const adminPasswordHash = await hashPassword('boutique2024!');
        const clientPasswordHash = await hashPassword('client2024!');

        // Check if admin user exists
        const adminCheck = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@boutique.local']);
        
        if (adminCheck.rows.length === 0) {
            // Create admin user
            const adminResult = await pool.query(
                `INSERT INTO users (email, username, password_hash, first_name, last_name, name, role, active, email_verified, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, NOW(), NOW())
                 RETURNING id, email, name, role`,
                [
                    'admin@boutique.local',
                    'admin',
                    adminPasswordHash,
                    'Admin',
                    'User',
                    'Admin User',
                    'ADMIN'
                ]
            );
            
            console.log('✅ Admin user created:', adminResult.rows[0]);
        } else {
            console.log('⚠️ Admin user already exists');
        }

        // Check if client user exists
        const clientCheck = await pool.query('SELECT id FROM users WHERE email = $1', ['client@boutique.local']);
        
        if (clientCheck.rows.length === 0) {
            // Create client user
            const clientResult = await pool.query(
                `INSERT INTO users (email, username, password_hash, first_name, last_name, name, role, active, email_verified, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, NOW(), NOW())
                 RETURNING id, email, name, role`,
                [
                    'client@boutique.local',
                    'client',
                    clientPasswordHash,
                    'Client',
                    'User',
                    'Client User',
                    'CLIENT'
                ]
            );
            
            console.log('✅ Client user created:', clientResult.rows[0]);
        } else {
            console.log('⚠️ Client user already exists');
        }

        console.log('\n🎯 Test credentials:');
        console.log('Admin: admin@boutique.local / boutique2024!');
        console.log('Client: client@boutique.local / client2024!');

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

createTestUsers();