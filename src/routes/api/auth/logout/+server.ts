import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	try {
		console.log('🔐 Server-side logout initiated');
		
		// Clear custom session cookie first
		cookies.delete('session', { path: '/' });
		
		// Clear all Auth.js related cookies
		const cookieNames = [
			'authjs.session-token',
			'__Secure-authjs.session-token', 
			'__Host-authjs.session-token',
			'authjs.csrf-token',
			'__Secure-authjs.csrf-token',
			'authjs.callback-url',
			'__Secure-authjs.callback-url',
			'next-auth.session-token',
			'__Secure-next-auth.session-token',
			'__Host-next-auth.session-token'
		];

		cookieNames.forEach(name => {
			cookies.delete(name, { path: '/' });
			cookies.delete(name, { path: '/', secure: true });
			cookies.delete(name, { path: '/', domain: 'localhost' });
		});

		// Clear any other session-related cookies
		cookies.delete('__session', { path: '/' });
		cookies.delete('connect.sid', { path: '/' });

		// Clear locals user
		locals.user = undefined;

		console.log('🔐 User logged out successfully');

		return json({ success: true, message: 'Logged out successfully' });
	} catch (error) {
		console.error('Logout error:', error);
		return json({ success: false, error: 'Logout failed' }, { status: 500 });
	}
};