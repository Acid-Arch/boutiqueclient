import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Always redirect to login page from root, regardless of authentication status
	// This ensures "everytime i start the server it goes directly to the login page"
	throw redirect(302, '/login');
};