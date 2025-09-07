import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db-loader';

export const GET: RequestHandler = async () => {
	try {
		console.log('Testing database connection...');
		
		// Test 1: Simple query
		console.log('Test 1: Simple SELECT 1');
		const test1 = await query('SELECT 1 as test');
		console.log('Test 1 result:', test1.rows);
		
		// Test 2: Show tables
		console.log('Test 2: Show tables');
		const test2 = await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'scraping%'");
		console.log('Test 2 result:', test2.rows);
		
		// Test 3: Simple scraping_sessions query
		console.log('Test 3: Count scraping_sessions');
		const test3 = await query('SELECT COUNT(*) as count FROM scraping_sessions');
		console.log('Test 3 result:', test3.rows);
		
		return json({
			success: true,
			tests: {
				simple: test1.rows,
				tables: test2.rows,
				count: test3.rows
			}
		});
		
	} catch (error) {
		console.error('Database test error:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		}, { status: 500 });
	}
};