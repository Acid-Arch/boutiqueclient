#!/usr/bin/env node

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

const SALT_ROUNDS = 12;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function createAdminUser() {
    console.log('🔧 Creating admin@boutique.local user...');
    
    try {
        // Test connection
        await pool.query('SELECT 1');
        console.log('✅ Database connected');

        // Check if admin user exists
        const adminCheck = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@boutique.local']);
        
        if (adminCheck.rows.length > 0) {
            console.log('⚠️ Admin user already exists');
            return;
        }

        // Hash password
        const passwordHash = await hashPassword('boutique2024!');
        const userId = `admin_${randomUUID().replace(/-/g, '')}`;

        // Create admin user matching the existing schema
        const adminResult = await pool.query(
            `INSERT INTO users (
                id, email, password_hash, name, role, subscription, active, 
                email_verified, provider, two_factor_enabled, failed_login_attempts,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
            RETURNING id, email, name, role, active`,
            [
                userId,                    // id
                'admin@boutique.local',    // email  
                passwordHash,              // password_hash
                'Admin User',              // name
                'ADMIN',                   // role
                'Premium',                 // subscription
                true,                      // active
                true,                      // email_verified
                'LOCAL',                   // provider
                false,                     // two_factor_enabled
                0                          // failed_login_attempts
            ]
        );
        
        console.log('✅ Admin user created:', adminResult.rows[0]);
        console.log('\n🎯 Admin credentials:');
        console.log('Email: admin@boutique.local');
        console.log('Password: boutique2024!');

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

createAdminUser();