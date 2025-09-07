import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Only return user data for authenticated routes
	const isClientPortal = url.pathname.startsWith('/client-portal');
	
	if (isClientPortal && locals.user) {
		return {
			user: {
				id: locals.user.id,
				name: locals.user.name,
				email: locals.user.email,
				role: locals.user.role,
				company: locals.user.company,
				avatar: locals.user.avatar,
				subscription: locals.user.subscription,
				isActive: locals.user.isActive
			}
		};
	}
	
	return {
		user: null
	};
};