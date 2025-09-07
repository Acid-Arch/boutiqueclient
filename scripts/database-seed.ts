import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Database Seeding Script for Boutique Client Portal
 * 
 * This script seeds the database with initial development data:
 * - Admin user account
 * - Sample client users
 * - Demo Instagram accounts
 * - Clone inventory data
 * - User preferences
 * 
 * Usage:
 *   npm run db:seed
 *   node --loader ts-node/esm scripts/database-seed.ts
 */

const prisma = new PrismaClient({
	log: ['info', 'warn', 'error'],
});

// Seed configuration
const SEED_CONFIG = {
	users: {
		createAdmin: true,
		createSampleClients: true,
		defaultPassword: 'demo123!',
	},
	accounts: {
		createSampleAccounts: true,
		accountsPerClient: 5,
	},
	devices: {
		createSampleDevices: true,
		deviceCount: 3,
		clonesPerDevice: 10,
	},
	audit: {
		enableAuditLogs: true,
	},
};

// Sample data
const SAMPLE_USERS = [
	{
		email: 'admin@boutique.com',
		username: 'admin',
		firstName: 'Admin',
		lastName: 'User',
		company: 'Boutique Portal',
		role: 'ADMIN' as const,
		subscription: 'Enterprise',
		accountsLimit: 1000,
		isActive: true,
		isVerified: true,
		emailVerified: true,
	},
	{
		email: 'sarah.marketing@techstartup.co',
		username: 'sarah_marketing',
		firstName: 'Sarah',
		lastName: 'Johnson',
		company: 'TechStartup Co',
		role: 'CLIENT' as const,
		subscription: 'Professional',
		accountsLimit: 50,
		isActive: true,
		isVerified: true,
		emailVerified: true,
	},
	{
		email: 'mike.social@fashionbrand.com',
		username: 'mike_social',
		firstName: 'Mike',
		lastName: 'Chen',
		company: 'Fashion Brand Inc',
		role: 'CLIENT' as const,
		subscription: 'Basic',
		accountsLimit: 25,
		isActive: true,
		isVerified: true,
		emailVerified: true,
	},
	{
		email: 'lisa.growth@fitnessgym.net',
		username: 'lisa_growth',
		firstName: 'Lisa',
		lastName: 'Rodriguez',
		company: 'Fitness Gym Chain',
		role: 'CLIENT' as const,
		subscription: 'Professional',
		accountsLimit: 75,
		isActive: true,
		isVerified: true,
		emailVerified: true,
	},
	{
		email: 'david.digital@restaurantchain.biz',
		username: 'david_digital',
		firstName: 'David',
		lastName: 'Thompson',
		company: 'Restaurant Chain LLC',
		role: 'VIEWER' as const,
		subscription: 'Basic',
		accountsLimit: 10,
		isActive: true,
		isVerified: true,
		emailVerified: true,
	},
];

const SAMPLE_DEVICES = [
	{
		deviceId: 'DEV-001-GALAXY-S24',
		deviceName: 'Samsung Galaxy S24 #1',
		health: 'Healthy' as const,
	},
	{
		deviceId: 'DEV-002-PIXEL-8',
		deviceName: 'Google Pixel 8 #1',
		health: 'Healthy' as const,
	},
	{
		deviceId: 'DEV-003-IPHONE-15',
		deviceName: 'iPhone 15 Pro #1',
		health: 'Warning' as const,
	},
];

const INSTAGRAM_USERNAMES = [
	'lifestyle_blogger_2024',
	'fitness_motivation_hub',
	'travel_adventures_daily',
	'foodie_discoveries',
	'fashion_trends_now',
	'tech_gadget_reviews',
	'home_decor_ideas',
	'pet_lovers_community',
	'art_inspiration_feed',
	'music_discovery_zone',
	'photography_tips',
	'business_growth_hacks',
	'wellness_journey',
	'outdoor_explorer',
	'creative_minds_unite',
];

// Utility functions
function generateEmail(username: string): string {
	return `${username.replace(/_/g, '.')}@demo.boutique.com`;
}

function generateInstagramPassword(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
	let password = '';
	for (let i = 0; i < 12; i++) {
		password += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return password;
}

function generateEmailPassword(): string {
	return generateInstagramPassword();
}

// Seeding functions
async function seedUsers() {
	console.log('🌱 Seeding users...');
	
	const hashedPassword = await bcrypt.hash(SEED_CONFIG.users.defaultPassword, 10);
	const createdUsers: any[] = [];
	
	for (const userData of SAMPLE_USERS) {
		try {
			// Check if user already exists
			const existingUser = await prisma.user.findUnique({
				where: { email: userData.email },
			});
			
			if (existingUser) {
				console.log(`  ⏭️  User already exists: ${userData.email}`);
				createdUsers.push(existingUser);
				continue;
			}
			
			const user = await prisma.user.create({
				data: {
					...userData,
					passwordHash: hashedPassword,
					lastActiveAt: new Date(),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
			
			console.log(`  ✅ Created user: ${user.email} (${user.role})`);
			createdUsers.push(user);
			
			// Create user preferences
			await prisma.userPreference.createMany({
				data: [
					{
						userId: user.id,
						preferenceKey: 'theme',
						preferenceValue: 'dark',
					},
					{
						userId: user.id,
						preferenceKey: 'notifications',
						preferenceValue: 'email',
					},
					{
						userId: user.id,
						preferenceKey: 'dashboard_layout',
						preferenceValue: 'grid',
					},
				],
			});
			
		} catch (error) {
			console.error(`  ❌ Failed to create user ${userData.email}:`, error);
		}
	}
	
	return createdUsers;
}

async function seedInstagramAccounts(users: any[]) {
	if (!SEED_CONFIG.accounts.createSampleAccounts) {
		console.log('⏭️  Skipping Instagram accounts seeding');
		return [];
	}
	
	console.log('🌱 Seeding Instagram accounts...');
	
	const clientUsers = users.filter(user => user.role === 'CLIENT');
	const createdAccounts: any[] = [];
	
	let usernameIndex = 0;
	
	for (const user of clientUsers) {
		console.log(`  📱 Creating accounts for ${user.email}...`);
		
		for (let i = 0; i < SEED_CONFIG.accounts.accountsPerClient && usernameIndex < INSTAGRAM_USERNAMES.length; i++) {
			const instagramUsername = INSTAGRAM_USERNAMES[usernameIndex++];
			
			try {
				// Check if account already exists
				const existingAccount = await prisma.igAccount.findUnique({
					where: { instagramUsername },
				});
				
				if (existingAccount) {
					console.log(`    ⏭️  Account already exists: ${instagramUsername}`);
					createdAccounts.push(existingAccount);
					continue;
				}
				
				const account = await prisma.igAccount.create({
					data: {
						instagramUsername,
						instagramPassword: generateInstagramPassword(),
						emailAddress: generateEmail(instagramUsername),
						emailPassword: generateEmailPassword(),
						status: Math.random() > 0.7 ? 'Assigned' : 'Unused', // 30% assigned
						imapStatus: 'On',
						ownerId: user.id,
						accountType: 'CLIENT',
						visibility: Math.random() > 0.8 ? 'SHARED' : 'PRIVATE', // 20% shared
						isShared: Math.random() > 0.8,
						createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
						updatedAt: new Date(),
					},
				});
				
				console.log(`    ✅ Created account: ${account.instagramUsername} -> ${user.email}`);
				createdAccounts.push(account);
				
			} catch (error) {
				console.error(`    ❌ Failed to create account ${instagramUsername}:`, error);
			}
		}
	}
	
	// Create some unassigned accounts
	console.log('  📱 Creating unassigned accounts...');
	const remainingUsernames = INSTAGRAM_USERNAMES.slice(usernameIndex);
	
	for (const instagramUsername of remainingUsernames) {
		try {
			// Check if account already exists
			const existingAccount = await prisma.igAccount.findUnique({
				where: { instagramUsername },
			});
			
			if (existingAccount) {
				console.log(`    ⏭️  Account already exists: ${instagramUsername}`);
				continue;
			}
			
			const account = await prisma.igAccount.create({
				data: {
					instagramUsername,
					instagramPassword: generateInstagramPassword(),
					emailAddress: generateEmail(instagramUsername),
					emailPassword: generateEmailPassword(),
					status: 'Unused',
					imapStatus: 'On',
					accountType: 'CLIENT',
					visibility: 'PRIVATE',
					isShared: false,
					createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
					updatedAt: new Date(),
				},
			});
			
			console.log(`    ✅ Created unassigned account: ${account.instagramUsername}`);
			createdAccounts.push(account);
			
		} catch (error) {
			console.error(`    ❌ Failed to create unassigned account ${instagramUsername}:`, error);
		}
	}
	
	return createdAccounts;
}

async function seedCloneInventory() {
	if (!SEED_CONFIG.devices.createSampleDevices) {
		console.log('⏭️  Skipping clone inventory seeding');
		return [];
	}
	
	console.log('🌱 Seeding clone inventory...');
	
	const createdClones: any[] = [];
	
	for (const deviceData of SAMPLE_DEVICES) {
		console.log(`  📱 Creating clones for ${deviceData.deviceId}...`);
		
		for (let cloneNumber = 1; cloneNumber <= SEED_CONFIG.devices.clonesPerDevice; cloneNumber++) {
			try {
				// Check if clone already exists
				const existingClone = await prisma.cloneInventory.findUnique({
					where: {
						deviceId_cloneNumber: {
							deviceId: deviceData.deviceId,
							cloneNumber,
						},
					},
				});
				
				if (existingClone) {
					console.log(`    ⏭️  Clone already exists: ${deviceData.deviceId}/${cloneNumber}`);
					createdClones.push(existingClone);
					continue;
				}
				
				// Determine clone status (most available, some assigned/logged in)
				let cloneStatus = 'Available';
				if (Math.random() > 0.8) {
					cloneStatus = Math.random() > 0.5 ? 'Assigned' : 'Logged In';
				} else if (Math.random() > 0.95) {
					cloneStatus = 'Broken';
				}
				
				const clone = await prisma.cloneInventory.create({
					data: {
						deviceId: deviceData.deviceId,
						cloneNumber,
						packageName: `com.instagram.android.clone${cloneNumber}`,
						cloneStatus,
						deviceName: deviceData.deviceName,
						cloneHealth: cloneStatus === 'Broken' ? 'Broken' : deviceData.health,
						lastScanned: new Date(Date.now() - Math.random() * 60 * 60 * 1000), // Within last hour
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				});
				
				console.log(`    ✅ Created clone: ${clone.deviceId}/${clone.cloneNumber} (${clone.cloneStatus})`);
				createdClones.push(clone);
				
			} catch (error) {
				console.error(`    ❌ Failed to create clone ${deviceData.deviceId}/${cloneNumber}:`, error);
			}
		}
	}
	
	return createdClones;
}

async function seedAuditLogs(users: any[]) {
	if (!SEED_CONFIG.audit.enableAuditLogs) {
		console.log('⏭️  Skipping audit logs seeding');
		return [];
	}
	
	console.log('🌱 Seeding audit logs...');
	
	const auditEvents = [
		{ type: 'LOGIN_SUCCESS', description: 'User logged in successfully' },
		{ type: 'LOGIN_SUCCESS', description: 'User logged in successfully' },
		{ type: 'PASSWORD_CHANGE', description: 'User changed password' },
		{ type: 'LOGIN_FAILURE', description: 'Failed login attempt - incorrect password' },
		{ type: 'LOGIN_SUCCESS', description: 'User logged in successfully' },
	];
	
	const createdAuditLogs: any[] = [];
	
	for (const user of users) {
		if (user.role === 'ADMIN') continue; // Skip admin for demo audit logs
		
		for (const event of auditEvents) {
			try {
				const auditLog = await prisma.auditLog.create({
					data: {
						userId: user.id,
						eventType: event.type as any,
						description: event.description,
						ipAddress: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
						userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
						success: event.type !== 'LOGIN_FAILURE',
						timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last week
					},
				});
				
				createdAuditLogs.push(auditLog);
				
			} catch (error) {
				console.error(`    ❌ Failed to create audit log for ${user.email}:`, error);
			}
		}
		
		console.log(`  ✅ Created audit logs for: ${user.email}`);
	}
	
	return createdAuditLogs;
}

async function assignAccountsToDevices(accounts: any[], clones: any[]) {
	console.log('🌱 Assigning accounts to devices...');
	
	// Get accounts that are marked as assigned/logged in
	const assignedAccounts = accounts.filter(account => 
		account.status === 'Assigned' || account.status === 'Logged In'
	);
	
	// Get available and assigned clones
	const availableClones = clones.filter(clone => 
		clone.cloneStatus === 'Available' || clone.cloneStatus === 'Assigned' || clone.cloneStatus === 'Logged In'
	);
	
	let cloneIndex = 0;
	
	for (const account of assignedAccounts) {
		if (cloneIndex >= availableClones.length) break;
		
		const clone = availableClones[cloneIndex++];
		
		try {
			// Update the account with device assignment
			await prisma.igAccount.update({
				where: { id: account.id },
				data: {
					assignedDeviceId: clone.deviceId,
					assignedCloneNumber: clone.cloneNumber,
					assignedPackageName: clone.packageName,
					assignmentTimestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Within last 24 hours
					loginTimestamp: account.status === 'Logged In' ? new Date() : null,
				},
			});
			
			// Update the clone with current account
			await prisma.cloneInventory.update({
				where: {
					deviceId_cloneNumber: {
						deviceId: clone.deviceId,
						cloneNumber: clone.cloneNumber,
					},
				},
				data: {
					cloneStatus: account.status,
					currentAccount: account.instagramUsername,
				},
			});
			
			console.log(`  ✅ Assigned ${account.instagramUsername} to ${clone.deviceId}/${clone.cloneNumber}`);
			
		} catch (error) {
			console.error(`  ❌ Failed to assign ${account.instagramUsername}:`, error);
		}
	}
}

async function createScrapingSessions() {
	console.log('🌱 Creating sample scraping sessions...');
	
	const sessionTypes = ['ACCOUNT_METRICS', 'FOLLOWER_ANALYSIS', 'CONTENT_ANALYSIS', 'TREND_ANALYSIS'];
	const sessionStatuses = ['COMPLETED', 'COMPLETED', 'RUNNING', 'FAILED'];
	
	const createdSessions: any[] = [];
	
	for (let i = 0; i < 5; i++) {
		try {
			const sessionType = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
			const status = sessionStatuses[Math.floor(Math.random() * sessionStatuses.length)];
			
			const session = await prisma.scrapingSession.create({
				data: {
					sessionType: sessionType as any,
					status: status as any,
					totalAccounts: Math.floor(Math.random() * 50 + 10),
					completedAccounts: status === 'COMPLETED' ? Math.floor(Math.random() * 50 + 10) : Math.floor(Math.random() * 20),
					failedAccounts: Math.floor(Math.random() * 3),
					progress: status === 'COMPLETED' ? 100 : Math.floor(Math.random() * 80 + 10),
					startTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
					endTime: status === 'COMPLETED' ? new Date() : null,
					totalRequestUnits: Math.floor(Math.random() * 1000 + 100),
					estimatedCost: Math.random() * 50 + 5,
					triggeredBy: 'demo-seed-script',
					triggerSource: 'MANUAL',
					createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
				},
			});
			
			createdSessions.push(session);
			console.log(`  ✅ Created scraping session: ${session.sessionType} (${session.status})`);
			
		} catch (error) {
			console.error(`  ❌ Failed to create scraping session:`, error);
		}
	}
	
	return createdSessions;
}

// Main seeding function
async function main() {
	console.log('🌱 Starting database seeding...\n');
	
	try {
		// Check database connection
		await prisma.$connect();
		console.log('✅ Database connected\n');
		
		// Seed data in order
		const users = await seedUsers();
		console.log(`📊 Created ${users.length} users\n`);
		
		const accounts = await seedInstagramAccounts(users);
		console.log(`📊 Created ${accounts.length} Instagram accounts\n`);
		
		const clones = await seedCloneInventory();
		console.log(`📊 Created ${clones.length} clone inventory entries\n`);
		
		await assignAccountsToDevices(accounts, clones);
		console.log('📊 Completed account-device assignments\n');
		
		const auditLogs = await seedAuditLogs(users);
		console.log(`📊 Created ${auditLogs.length} audit log entries\n`);
		
		const scrapingSessions = await createScrapingSessions();
		console.log(`📊 Created ${scrapingSessions.length} scraping sessions\n`);
		
		console.log('✅ Database seeding completed successfully!');
		console.log('\n📋 Seeding Summary:');
		console.log(`   👥 Users: ${users.length}`);
		console.log(`   📱 Instagram Accounts: ${accounts.length}`);
		console.log(`   🔧 Clone Inventory: ${clones.length}`);
		console.log(`   📝 Audit Logs: ${auditLogs.length}`);
		console.log(`   🚀 Scraping Sessions: ${scrapingSessions.length}`);
		
		console.log('\n🔐 Login Credentials:');
		console.log('   Email: admin@boutique.com');
		console.log('   Email: sarah.marketing@techstartup.co');
		console.log('   Email: mike.social@fashionbrand.com');
		console.log('   Password (all users): demo123!');
		
	} catch (error) {
		console.error('❌ Seeding failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Error handling
process.on('unhandledRejection', (error) => {
	console.error('❌ Unhandled rejection:', error);
	process.exit(1);
});

process.on('uncaughtException', (error) => {
	console.error('❌ Uncaught exception:', error);
	process.exit(1);
});

// Execute seeding
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export default main;