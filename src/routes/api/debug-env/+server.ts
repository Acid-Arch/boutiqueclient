import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		return json({
			success: true,
			environment: {
				DATABASE_URL: process.env.DATABASE_URL || 'not set',
				NODE_ENV: process.env.NODE_ENV || 'not set',
				DATABASE_URL_masked: process.env.DATABASE_URL ? 
					process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@') : 
					'not set'
			}
		});
		
	} catch (error) {
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};