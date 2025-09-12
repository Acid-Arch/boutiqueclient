import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/database';
import pg from 'pg';

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const settings = await request.json();
		console.log(`⚙️ Saving settings for user: ${locals.user.email}`, settings);

		// Try to save settings using direct SQL (since Prisma may not be available on NixOS)
		const result = await saveUserSettingsDirectSQL(locals.user, settings);

		if (result.success) {
			return json({ 
				success: true, 
				message: 'Settings saved successfully',
				settings: result.settings
			});
		} else {
			return json({ error: 'Failed to save settings' }, { status: 500 });
		}

	} catch (error) {
		console.error('Error saving settings:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

async function saveUserSettingsDirectSQL(user: any, settings: any) {
	const { Client } = pg;
	const client = new Client({
		connectionString: process.env.DATABASE_URL
	});

	try {
		await client.connect();

		// Update user settings in the database
		const updateQuery = `
			UPDATE users 
			SET 
				name = $2,
				company = $3,
				updated_at = NOW()
			WHERE id = $1 OR email = $4
			RETURNING id, name, email, company, role, updated_at
		`;

		const result = await client.query(updateQuery, [
			user.id,
			settings.profile?.name || user.name,
			settings.profile?.company || '',
			user.email
		]);

		if (result.rows.length > 0) {
			const updatedUser = result.rows[0];
			console.log(`✅ Settings updated for user: ${user.email}`);
			
			return {
				success: true,
				settings: {
					profile: {
						name: updatedUser.name,
						email: updatedUser.email,
						company: updatedUser.company,
						role: updatedUser.role
					},
					lastUpdated: updatedUser.updated_at
				}
			};
		} else {
			console.log(`❌ No user found to update: ${user.email}`);
			return { success: false };
		}

	} catch (sqlError) {
		console.error('Failed to save settings via direct SQL:', sqlError);
		return { success: false };
	} finally {
		await client.end();
	}
}