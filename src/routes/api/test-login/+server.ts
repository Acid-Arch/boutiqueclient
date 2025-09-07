import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	console.log('🧪 Test login API endpoint called');
	
	try {
		const body = await request.json();
		console.log('📝 Received body:', body);
		
		return json({
			success: true,
			message: 'Test API working',
			received: body
		});
	} catch (error) {
		console.error('❌ Test API error:', error);
		return json({
			success: false,
			error: 'Test API failed'
		}, { status: 500 });
	}
};