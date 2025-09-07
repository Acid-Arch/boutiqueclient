<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { z } from 'zod';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Instagram, User, Mail, Smartphone, Eye, EyeOff, Key, Shield, X } from 'lucide-svelte';

	export let open = false;

	const dispatch = createEventDispatcher<{
		submit: { username: string; email: string; password: string; };
		close: void;
	}>();

	// Validation schema with comprehensive rules
	const addAccountSchema = z.object({
		username: z
			.string()
			.min(1, 'Instagram username is required')
			.min(3, 'Username must be at least 3 characters')
			.max(30, 'Username cannot exceed 30 characters')
			.regex(/^[a-zA-Z0-9._]+$/, 'Username can only contain letters, numbers, dots, and underscores')
			.refine(val => !val.startsWith('.'), 'Username cannot start with a dot')
			.refine(val => !val.endsWith('.'), 'Username cannot end with a dot'),
		
		email: z
			.string()
			.min(1, 'Email is required')
			.email('Please enter a valid email address'),
		
		password: z
			.string()
			.min(1, 'Password is required')
			.min(6, 'Password must be at least 6 characters long'),
		
		confirmPassword: z
			.string()
			.min(1, 'Please confirm your password'),
		
		deviceId: z
			.string()
			.optional(),
		
		visibility: z
			.enum(['private', 'shared'])
			.default('private'),
		
		autoFollow: z
			.boolean()
			.default(false),
		
		autoLike: z
			.boolean()
			.default(false),
		
		notes: z
			.string()
			.max(500, 'Notes cannot exceed 500 characters')
			.optional()
	}).refine(data => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"]
	});

	// Form data and state
	let form = {
		username: '',
		email: '',
		password: '',
		confirmPassword: '',
		deviceId: '',
		visibility: 'private',
		autoFollow: false,
		autoLike: false,
		notes: ''
	};

	let errors: Record<string, string[]> = {};
	let submitting = false;

	// Fetch available devices from API
	let availableDevices: Array<{id: string, name: string, status: string}> = [];
	
	// Load devices on component mount
	onMount(async () => {
		try {
			const response = await fetch('/api/devices');
			if (response.ok) {
				const devices = await response.json();
				availableDevices = devices.map((device: any) => ({
					id: device.device_id || device.id,
					name: device.device_id || device.name,
					status: device.online ? 'Online' : 'Offline'
				}));
			}
		} catch (error) {
			console.error('Failed to load devices:', error);
		}
	});

	let showPassword = false;
	let showConfirmPassword = false;

	function validateForm() {
		const result = addAccountSchema.safeParse(form);
		errors = {};
		
		if (!result.success) {
			result.error.issues.forEach((issue) => {
				const path = issue.path[0] as string;
				if (!errors[path]) {
					errors[path] = [];
				}
				errors[path].push(issue.message);
			});
			return false;
		}
		return true;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		
		if (!validateForm()) {
			return;
		}

		submitting = true;
		
		try {
			// Simulate API call delay
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			dispatch('submit', {
				username: form.username,
				email: form.email,
				password: form.password
			});
			
			handleClose();
		} catch (error) {
			console.error('Error submitting form:', error);
		} finally {
			submitting = false;
		}
	}

	function handleClose() {
		open = false;
		dispatch('close');
		// Reset form
		Object.keys(form).forEach(key => {
			if (typeof form[key] === 'boolean') {
				form[key] = false;
			} else {
				form[key] = '';
			}
		});
		form.visibility = 'private';
		errors = {};
	}

	function togglePasswordVisibility(field: 'password' | 'confirmPassword') {
		if (field === 'password') {
			showPassword = !showPassword;
		} else {
			showConfirmPassword = !showConfirmPassword;
		}
	}
</script>

<!-- Modal Backdrop and Container -->
{#if open}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
			<!-- Header -->
			<div class="p-6 border-b border-white/10">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-xl font-bold text-white flex items-center">
							<Instagram class="h-6 w-6 mr-2 text-blue-400" />
							Add Instagram Account
						</h2>
						<p class="text-slate-400 mt-1">
							Connect a new Instagram account to your automation system. All information is encrypted and securely stored.
						</p>
					</div>
					<button 
						type="button" 
						on:click={handleClose}
						class="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-2"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			<!-- Form Content -->
			<form on:submit={handleSubmit} class="p-6 space-y-6">
				<!-- Account Credentials Section -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-white flex items-center">
						<User class="h-5 w-5 mr-2 text-blue-400" />
						Account Credentials
					</h3>
					
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Instagram Username -->
						<div>
							<Label class="text-slate-300">Instagram Username</Label>
							<div class="relative mt-1">
								<Input
									bind:value={form.username}
									placeholder="your_username"
									class="bg-white/5 border-white/20 text-white pl-10 {errors.username ? 'border-red-500/50' : ''}"
								/>
								<Instagram class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
							</div>
							<p class="text-slate-500 text-sm mt-1">
								Enter your Instagram username without @
							</p>
							{#if errors.username}
								<div class="text-red-400 text-sm mt-1">
									{#each errors.username as error}
										<p>{error}</p>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Email -->
						<div>
							<Label class="text-slate-300">Email Address</Label>
							<div class="relative mt-1">
								<Input
									type="email"
									bind:value={form.email}
									placeholder="email@domain.com"
									class="bg-white/5 border-white/20 text-white pl-10 {errors.email ? 'border-red-500/50' : ''}"
								/>
								<Mail class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
							</div>
							<p class="text-slate-500 text-sm mt-1">
								Account recovery email address
							</p>
							{#if errors.email}
								<div class="text-red-400 text-sm mt-1">
									{#each errors.email as error}
										<p>{error}</p>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Password -->
						<div>
							<Label class="text-slate-300">Password</Label>
							<div class="relative mt-1">
								<Input
									type={showPassword ? 'text' : 'password'}
									bind:value={form.password}
									placeholder="Enter password"
									class="bg-white/5 border-white/20 text-white pl-10 pr-10 {errors.password ? 'border-red-500/50' : ''}"
								/>
								<Key class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-white/10"
									on:click={() => togglePasswordVisibility('password')}
								>
									<svelte:component this={showPassword ? EyeOff : Eye} class="h-4 w-4 text-slate-400" />
								</Button>
							</div>
							{#if errors.password}
								<div class="text-red-400 text-sm mt-1">
									{#each errors.password as error}
										<p>{error}</p>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Confirm Password -->
						<div>
							<Label class="text-slate-300">Confirm Password</Label>
							<div class="relative mt-1">
								<Input
									type={showConfirmPassword ? 'text' : 'password'}
									bind:value={form.confirmPassword}
									placeholder="Confirm password"
									class="bg-white/5 border-white/20 text-white pl-10 pr-10 {errors.confirmPassword ? 'border-red-500/50' : ''}"
								/>
								<Shield class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-white/10"
									on:click={() => togglePasswordVisibility('confirmPassword')}
								>
									<svelte:component this={showConfirmPassword ? EyeOff : Eye} class="h-4 w-4 text-slate-400" />
								</Button>
							</div>
							{#if errors.confirmPassword}
								<div class="text-red-400 text-sm mt-1">
									{#each errors.confirmPassword as error}
										<p>{error}</p>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Configuration Section -->
				<div class="space-y-4">
					<h3 class="text-lg font-semibold text-white flex items-center">
						<Smartphone class="h-5 w-5 mr-2 text-green-400" />
						Configuration
					</h3>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Device Assignment -->
						<div>
							<Label class="text-slate-300">Assign Device (Optional)</Label>
							<Select bind:selected={form.deviceId}>
								<SelectTrigger class="bg-white/5 border-white/20 text-white mt-1">
									{form.deviceId ? availableDevices.find(d => d.id === form.deviceId)?.name || 'Select a device' : 'Select a device'}
								</SelectTrigger>
								<SelectContent class="bg-slate-900 border-white/20">
									<SelectItem value="">No device assigned</SelectItem>
									{#each availableDevices as device}
										<SelectItem value={device.id} disabled={device.status === 'Offline'}>
											{device.name} ({device.status})
										</SelectItem>
									{/each}
								</SelectContent>
							</Select>
							<p class="text-slate-500 text-sm mt-1">
								Choose which device will manage this account
							</p>
						</div>

						<!-- Visibility -->
						<div>
							<Label class="text-slate-300">Account Visibility</Label>
							<Select bind:selected={form.visibility}>
								<SelectTrigger class="bg-white/5 border-white/20 text-white mt-1">
									{form.visibility === 'private' ? 'Private - Only you can see' : 'Shared - Team can view'}
								</SelectTrigger>
								<SelectContent class="bg-slate-900 border-white/20">
									<SelectItem value="private">Private - Only you can see</SelectItem>
									<SelectItem value="shared">Shared - Team can view</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<!-- Automation Options -->
					<div class="space-y-3">
						<Label class="text-slate-300">Automation Settings</Label>
						<div class="space-y-2">
							<div class="flex items-center space-x-2">
								<Checkbox bind:checked={form.autoFollow} id="autoFollow" />
								<Label for="autoFollow" class="text-sm text-slate-400">
									Enable auto-follow functionality
								</Label>
							</div>
							<div class="flex items-center space-x-2">
								<Checkbox bind:checked={form.autoLike} id="autoLike" />
								<Label for="autoLike" class="text-sm text-slate-400">
									Enable auto-like functionality
								</Label>
							</div>
						</div>
					</div>

					<!-- Notes -->
					<div>
						<Label class="text-slate-300">Notes (Optional)</Label>
						<Textarea
							bind:value={form.notes}
							placeholder="Add any notes about this account..."
							class="bg-white/5 border-white/20 text-white resize-none mt-1 {errors.notes ? 'border-red-500/50' : ''}"
							rows="3"
						/>
						<p class="text-slate-500 text-sm mt-1">
							Additional information about this Instagram account
						</p>
						{#if errors.notes}
							<div class="text-red-400 text-sm mt-1">
								{#each errors.notes as error}
									<p>{error}</p>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Footer -->
				<div class="flex justify-end gap-2 pt-4 border-t border-white/10">
					<Button 
						type="button" 
						variant="outline" 
						on:click={handleClose}
						class="border-white/20 text-white hover:bg-white/10"
					>
						Cancel
					</Button>
					<Button 
						type="submit"
						class="bg-blue-600 hover:bg-blue-700 text-white {submitting ? 'opacity-50' : ''}"
						disabled={submitting}
					>
						{#if submitting}
							<div class="flex items-center">
								<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
								Adding Account...
							</div>
						{:else}
							<Instagram class="h-4 w-4 mr-2" />
							Add Account
						{/if}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}