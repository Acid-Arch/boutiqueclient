#!/usr/bin/env node

import { AuthService } from './src/lib/server/auth-direct.ts';
import pgDirect from './src/lib/server/postgres-direct.ts';

async function createTestUsers() {
    console.log('🔧 Creating test users...');
    
    try {
        // Test database connection first
        const isConnected = await pgDirect.testConnection();
        if (!isConnected) {
            console.error('❌ Database connection failed');
            process.exit(1);
        }
        console.log('✅ Database connected');

        // Check if admin user already exists
        const existingAdmin = await pgDirect.findUserByEmail('admin@boutique.local');
        if (existingAdmin) {
            console.log('⚠️ Admin user already exists');
        } else {
            // Create admin user
            const adminUser = await AuthService.createUser({
                email: 'admin@boutique.local',
                username: 'admin',
                password: 'boutique2024!',
                firstName: 'Admin',
                lastName: 'User',
                role: 'ADMIN'
            });

            if (adminUser) {
                console.log('✅ Admin user created:', adminUser.email);
            } else {
                console.error('❌ Failed to create admin user');
            }
        }

        // Check if client user already exists
        const existingClient = await pgDirect.findUserByEmail('client@boutique.local');
        if (existingClient) {
            console.log('⚠️ Client user already exists');
        } else {
            // Create client user
            const clientUser = await AuthService.createUser({
                email: 'client@boutique.local',
                username: 'client',
                password: 'client2024!',
                firstName: 'Client',
                lastName: 'User',
                role: 'CLIENT'
            });

            if (clientUser) {
                console.log('✅ Client user created:', clientUser.email);
            } else {
                console.error('❌ Failed to create client user');
            }
        }

        console.log('\n🎯 Test credentials:');
        console.log('Admin: admin@boutique.local / boutique2024!');
        console.log('Client: client@boutique.local / client2024!');

    } catch (error) {
        console.error('❌ Error creating test users:', error);
        process.exit(1);
    } finally {
        await pgDirect.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);
    }
}

createTestUsers();