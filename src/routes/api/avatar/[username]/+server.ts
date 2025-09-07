import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db-loader';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const username = params.username;
		const size = parseInt(url.searchParams.get('size') || '80');
		
		if (!username) {
			return new Response('Username required', { status: 400 });
		}
		
		// Try to get profile picture from account metrics
		try {
			const profileResult = await query(`
				SELECT profile_picture_url 
				FROM account_metrics 
				WHERE username = $1 
				ORDER BY scraped_at DESC 
				LIMIT 1
			`, [username]);
			
			if (profileResult?.rows?.[0]?.profile_picture_url) {
				const profilePictureUrl = profileResult.rows[0].profile_picture_url;
				
				// If it's a valid URL, redirect to it
				if (profilePictureUrl.startsWith('http')) {
					return new Response(null, {
						status: 302,
						headers: {
							'Location': profilePictureUrl,
							'Cache-Control': 'public, max-age=3600'
						}
					});
				}
			}
		} catch (error) {
			console.log('Could not fetch profile picture from database:', error);
		}
		
		// Generate a placeholder avatar using dicebear API
		const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&size=${size}&backgroundColor=3b82f6&textColor=ffffff`;
		
		return new Response(null, {
			status: 302,
			headers: {
				'Location': avatarUrl,
				'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
			}
		});
		
	} catch (error) {
		console.error('Avatar API error:', error);
		
		// Fallback to a simple placeholder
		const fallbackUrl = `https://api.dicebear.com/7.x/initials/svg?seed=user&size=80&backgroundColor=6b7280&textColor=ffffff`;
		
		return new Response(null, {
			status: 302,
			headers: {
				'Location': fallbackUrl,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	}
};