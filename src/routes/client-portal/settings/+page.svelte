<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { 
		User,
		Bell,
		Shield,
		Globe,
		Mail,
		Lock,
		Save
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let mounted = false;
	let saving = false;
	let saveMessage = '';

	// User data loaded from server-side
	$: userSettings = data.userSettings;

	onMount(() => {
		mounted = true;
	});

	async function saveSettings() {
		console.log('🔥 saveSettings function called!');
		if (saving) return; // Prevent multiple simultaneous saves
		
		saving = true;
		saveMessage = '';

		try {
			console.log('🔥 Saving settings...', userSettings);
			
			const response = await fetch('/api/settings', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					profile: {
						name: userSettings.profile.name,
						company: userSettings.profile.company
					},
					notifications: userSettings.notifications
				})
			});

			if (response.ok) {
				const result = await response.json();
				saveMessage = '✅ Settings saved successfully!';
				console.log('Settings saved:', result);
				
				// Clear success message after 3 seconds
				setTimeout(() => {
					saveMessage = '';
				}, 3000);
			} else {
				const error = await response.json();
				saveMessage = `❌ Error: ${error.error || 'Failed to save settings'}`;
				console.error('Save error:', error);
			}
		} catch (error) {
			saveMessage = '❌ Network error occurred while saving';
			console.error('Network error:', error);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - Client Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-white">Settings</h1>
			<p class="text-slate-300 mt-1">Manage your account preferences and configuration</p>
		</div>
		<div class="flex flex-col items-end gap-2 relative z-10">
			{#if saveMessage}
				<div class="text-sm {saveMessage.startsWith('✅') ? 'text-green-400' : 'text-red-400'}">
					{saveMessage}
				</div>
			{/if}
			<Button 
				onclick={saveSettings} 
				disabled={saving}
				class="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed relative z-20"
			>
				<Save class="w-4 h-4 mr-2" />
				{saving ? 'Saving...' : 'Save Changes'}
			</Button>
		</div>
	</div>

	{#if mounted}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Profile Settings -->
			<div class="lg:col-span-2 space-y-6">
				<Card class="glass-card border-white/10">
					<CardHeader>
						<CardTitle class="text-white flex items-center">
							<User class="w-5 h-5 mr-2" />
							Profile Information
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label class="text-slate-300">Full Name</Label>
								<Input 
									bind:value={userSettings.profile.name}
									class="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
								/>
							</div>
							<div>
								<Label class="text-slate-300">Email</Label>
								<Input 
									value={userSettings.profile.email}
									type="email"
									readonly
									class="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
								/>
							</div>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<Label class="text-slate-300">Company</Label>
								<Input 
									bind:value={userSettings.profile.company}
									class="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
								/>
							</div>
							<div>
								<Label class="text-slate-300">Role</Label>
								<Input 
									value={userSettings.profile.role}
									disabled
									class="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				<!-- Notification Settings -->
				<Card class="glass-card border-white/10">
					<CardHeader>
						<CardTitle class="text-white flex items-center">
							<Bell class="w-5 h-5 mr-2" />
							Notification Preferences
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<Label class="text-white">Email Alerts</Label>
								<p class="text-sm text-slate-400">Receive alerts for account activities</p>
							</div>
							<Button 
								variant="outline" 
								size="sm"
								class={userSettings.notifications.emailAlerts ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'border-white/20 text-white bg-transparent'}
								on:click={() => userSettings.notifications.emailAlerts = !userSettings.notifications.emailAlerts}
							>
								{userSettings.notifications.emailAlerts ? 'On' : 'Off'}
							</Button>
						</div>
						<div class="flex items-center justify-between">
							<div>
								<Label class="text-white">Push Notifications</Label>
								<p class="text-sm text-slate-400">Browser notifications for urgent updates</p>
							</div>
							<Button 
								variant="outline" 
								size="sm"
								class={userSettings.notifications.pushNotifications ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'border-white/20 text-white bg-transparent'}
								on:click={() => userSettings.notifications.pushNotifications = !userSettings.notifications.pushNotifications}
							>
								{userSettings.notifications.pushNotifications ? 'On' : 'Off'}
							</Button>
						</div>
						<div class="flex items-center justify-between">
							<div>
								<Label class="text-white">Weekly Reports</Label>
								<p class="text-sm text-slate-400">Summary of your account performance</p>
							</div>
							<Button 
								variant="outline" 
								size="sm"
								class={userSettings.notifications.weeklyReports ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'border-white/20 text-white bg-transparent'}
								on:click={() => userSettings.notifications.weeklyReports = !userSettings.notifications.weeklyReports}
							>
								{userSettings.notifications.weeklyReports ? 'On' : 'Off'}
							</Button>
						</div>
					</CardContent>
				</Card>

			</div>

			<!-- Sidebar Info -->
			<div class="space-y-6">
				<!-- Security Status -->
				<Card class="glass-card border-white/10">
					<CardHeader>
						<CardTitle class="text-white flex items-center">
							<Shield class="w-5 h-5 mr-2" />
							Security Status
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-slate-300">Two-Factor Auth</span>
							<Badge variant="outline" class="bg-green-500/20 text-green-400 border-green-500/50">
								Enabled
							</Badge>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-slate-300">Active Sessions</span>
							<Badge variant="outline" class="bg-blue-500/20 text-blue-400 border-blue-500/50">
								{userSettings.security.activeSessions}
							</Badge>
						</div>
						<div>
							<span class="text-slate-300 text-sm">Last password change</span>
							<p class="text-white">{userSettings.security.lastPasswordChange}</p>
						</div>
						<Button variant="outline" class="w-full border-white/20 text-white hover:bg-white/10 bg-transparent">
							<Lock class="w-4 h-4 mr-2" />
							Change Password
						</Button>
					</CardContent>
				</Card>

				<!-- Subscription Info -->
				<Card class="glass-card border-white/10">
					<CardHeader>
						<CardTitle class="text-white flex items-center">
							<Globe class="w-5 h-5 mr-2" />
							Subscription
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-slate-300">Plan</span>
							<Badge variant="outline" class="bg-blue-500/20 text-blue-400 border-blue-500/50">
								{userSettings.subscription.plan}
							</Badge>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-slate-300">Accounts</span>
							<span class="text-white">{userSettings.subscription.currentAccounts}/{userSettings.subscription.accountLimit}</span>
						</div>
						<div>
							<span class="text-slate-300 text-sm">Next billing</span>
							<p class="text-white">{userSettings.subscription.nextBilling}</p>
						</div>
						<Button variant="outline" class="w-full border-white/20 text-white hover:bg-white/10 bg-transparent">
							<Mail class="w-4 h-4 mr-2" />
							Manage Billing
						</Button>
					</CardContent>
				</Card>

			</div>
		</div>
	{/if}
</div>