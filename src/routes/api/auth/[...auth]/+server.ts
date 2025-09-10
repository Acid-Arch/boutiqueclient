import { SvelteKitAuth } from '@auth/sveltekit';
import { authConfig } from '../../../../auth.js';

export const { GET, POST } = SvelteKitAuth(authConfig);