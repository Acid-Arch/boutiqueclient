<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { signOut } from '@auth/sveltekit/client';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils/cn.js';
	import { Button } from '$lib/components/ui/button';
	import { Avatar, AvatarImage, AvatarFallback } from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { 
		Home,
		Users,
		Settings,
		LogOut,
		Menu,
		User,
		Database,
		AlertTriangle,
		Clock
	} from 'lucide-svelte';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	let sidebarOpen = false;
	let mounted = false;
	let inactivityTimer: NodeJS.Timeout | null = null;
	let inactivityWarningTimer: NodeJS.Timeout | null = null;
	let showInactivityWarning = false;
	
	// Auto-logout settings
	const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
	const WARNING_TIMEOUT = 4.5 * 60 * 1000; // Show warning at 4.5 minutes

	// Get user data from authenticated session
	$: user = data.user;

	const navigation = [
		{ name: 'Dashboard', href: '/client-portal', icon: Home },
		{ name: 'Instagram Accounts', href: '/client-portal/accounts', icon: Users },
		{ name: 'Analytics', href: '/client-portal/analytics', icon: Database },
		{ name: 'Settings', href: '/client-portal/settings', icon: Settings }
	];

	onMount(() => {
		mounted = true;
		
		// Only setup inactivity tracking for authenticated users in client portal
		if (user && $page.url.pathname.startsWith('/client-portal')) {
			setupInactivityTracking();
		}
	});
	
	function setupInactivityTracking() {
		console.log('🔐 Setting up inactivity tracking with timeouts:', { WARNING_TIMEOUT, INACTIVITY_TIMEOUT });
		
		const resetInactivityTimer = () => {
			// Clear existing timers
			if (inactivityTimer) clearTimeout(inactivityTimer);
			if (inactivityWarningTimer) clearTimeout(inactivityWarningTimer);
			showInactivityWarning = false;
			
			console.log('🔐 Resetting inactivity timers');
			
			// Set warning timer (3 seconds before logout)
			inactivityWarningTimer = setTimeout(() => {
				showInactivityWarning = true;
				console.log('🔐 Inactivity warning: Auto-logout in 3 seconds');
			}, WARNING_TIMEOUT);
			
			// Set logout timer
			inactivityTimer = setTimeout(() => {
				console.log('🔐 Auto-logout due to inactivity - calling handleLogout()');
				handleLogout();
			}, INACTIVITY_TIMEOUT);
		};
		
		// Make timers globally accessible for debugging
		(window as any).inactivityDebug = {
			showWarning: () => showInactivityWarning = true,
			triggerLogout: () => handleLogout(),
			resetTimer: resetInactivityTimer,
			getTimerState: () => ({
				hasWarningTimer: !!inactivityWarningTimer,
				hasLogoutTimer: !!inactivityTimer,
				showingWarning: showInactivityWarning
			})
		};
		
		// Track user activity
		const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
		
		activityEvents.forEach(event => {
			document.addEventListener(event, resetInactivityTimer, true);
		});
		
		// Start the timer
		resetInactivityTimer();
		
		// Cleanup on unmount
		return () => {
			activityEvents.forEach(event => {
				document.removeEventListener(event, resetInactivityTimer, true);
			});
			if (inactivityTimer) clearTimeout(inactivityTimer);
			if (inactivityWarningTimer) clearTimeout(inactivityWarningTimer);
		};
	}
	
	function extendSession() {
		showInactivityWarning = false;
		if (user && $page.url.pathname.startsWith('/client-portal')) {
			setupInactivityTracking();
		}
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	async function handleLogout() {
		try {
			console.log('🔐 Starting logout process...');
			
			// Call our custom logout API to clear server sessions
			try {
				const response = await fetch('/api/logout', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					}
				});
				
				if (response.ok) {
					const result = await response.json();
					console.log('🔐 Custom logout successful:', result);
				}
			} catch (fetchError) {
				console.log('🔐 Custom logout API call failed:', fetchError);
			}
			
			// Use Auth.js signOut to properly clear JWT sessions
			try {
				if (typeof signOut !== 'undefined') {
					console.log('🔐 Using Auth.js signOut');
					await signOut({ callbackUrl: '/login', redirect: true });
					return; // Let Auth.js handle the redirect
				}
			} catch (authError) {
				console.log('🔐 Auth.js signOut failed:', authError);
			}
			
			// Fallback: Clear client-side storage and cookies
			console.log('🔐 Using fallback logout method');
			if (typeof localStorage !== 'undefined') {
				localStorage.clear();
			}
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.clear();
			}
			
			// Clear cookies manually
			document.cookie.split(";").forEach(function(c) { 
				document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
			});
			
			// Force redirect to login
			console.log('🔐 Redirecting to login...');
			window.location.href = '/login';
			
		} catch (error) {
			console.error('Logout error:', error);
			// Force redirect to login as fallback
			window.location.href = '/login';
		}
	}

	$: currentPath = $page.url.pathname;
	$: isClientPortal = currentPath.startsWith('/client-portal');
</script>

<div class="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
	<!-- Background decoration -->
	<div class="absolute inset-0 opacity-30">
		<div class="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-800/20 to-purple-800/20"></div>
		<div class="absolute inset-0" style="background-image: radial-gradient(circle at 25% 25%, rgba(30, 58, 138, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(15, 23, 42, 0.1) 0%, transparent 50%);"></div>
	</div>
	
	{#if isClientPortal && mounted}
		<!-- Client Portal Layout -->
		<div class="flex h-screen">
			<!-- Sidebar -->
			<div class={cn(
				"fixed inset-y-0 z-50 flex flex-col transition-all duration-300 w-64",
				sidebarOpen ? "left-0" : "-left-64"
			)}>
				<!-- Sidebar glass container -->
				<div class="glass-card h-full p-4 border-r border-white/10 rounded-none rounded-r-2xl">
					<!-- Logo/Brand -->
					<div class="flex items-center mb-8">
						<div class="text-2xl font-bold text-white">
							✨ Client Portal
						</div>
					</div>

					<!-- User Info -->
					<div class="glass p-4 rounded-lg mb-6">
						<div class="flex items-center space-x-3">
							<Avatar class="h-10 w-10">
								<AvatarImage src={user.avatar} alt={user.name} />
								<AvatarFallback class="bg-purple-500/20 text-white">
									{user.name.split(' ').map(n => n[0]).join('')}
								</AvatarFallback>
							</Avatar>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-white truncate">
									{user.name}
								</p>
								<p class="text-xs text-slate-300 truncate">
									{user.company}
								</p>
							</div>
						</div>
						<div class="mt-3 flex items-center justify-between">
							<Badge variant="secondary" class="bg-blue-500/20 text-blue-200 hover:bg-blue-500/30">
								{user.subscription}
							</Badge>
							<Badge variant="outline" class="border-slate-500 text-slate-300">
								{user.role}
							</Badge>
						</div>
					</div>

					<!-- Navigation -->
					<nav class="space-y-2">
						{#each navigation as item}
							<a
								href={item.href}
								class={cn(
									"flex items-center text-sm font-medium rounded-lg transition-all duration-200 px-3 py-2",
									currentPath === item.href
										? "bg-blue-500/20 text-white shadow-lg"
										: "text-slate-300 hover:bg-white/5 hover:text-white"
								)}
							>
								<svelte:component this={item.icon} class="h-5 w-5 mr-3" />
								{item.name}
							</a>
						{/each}
					</nav>

					<!-- Logout -->
					<div class="mt-auto pt-6">
						<Button 
							variant="ghost" 
							class="w-full text-slate-300 hover:text-white hover:bg-red-500/10 bg-transparent"
							onclick={handleLogout}
						>
							<LogOut class="h-4 w-4 mr-2" />
							Sign Out
						</Button>
					</div>
				</div>
			</div>

			<!-- Main Content -->
			<div class={cn(
				"flex-1 transition-all duration-300",
				sidebarOpen ? "ml-64" : "ml-0"
			)}>
				<!-- Top Bar -->
				<header class="glass-card border-b border-white/10 px-6 py-4">
					<div class="flex items-center justify-between">
						<button
							on:click={toggleSidebar}
							class="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
						>
							<Menu class="h-5 w-5" />
						</button>
						
						<div class="text-white">
							<h1 class="text-xl font-semibold">
								{navigation.find(n => n.href === currentPath)?.name || 'Dashboard'}
							</h1>
						</div>
						
						<div class="flex items-center space-x-4">
							<Badge variant="outline" class="border-green-500 text-green-400">
								● Online
							</Badge>
						</div>
					</div>
				</header>

				<!-- Page Content -->
				<main class="p-6">
					<slot />
				</main>
			</div>
		</div>
	{:else}
		<!-- Public/Auth Layout -->
		<main class="min-h-screen flex items-center justify-center p-4">
			<slot />
		</main>
	{/if}
</div>

<!-- Inactivity Warning Modal -->
{#if showInactivityWarning}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
		<div class="glass-card max-w-md w-full p-6 border-yellow-500/50">
			<div class="flex items-center mb-4">
				<AlertTriangle class="h-8 w-8 text-yellow-400 mr-3" />
				<div>
					<h3 class="text-lg font-semibold text-white">Session Timeout Warning</h3>
					<p class="text-sm text-slate-300">You will be automatically logged out in 30 seconds due to inactivity.</p>
				</div>
			</div>
			
			<div class="flex items-center justify-between pt-4">
				<div class="flex items-center text-sm text-slate-400">
					<Clock class="h-4 w-4 mr-1" />
					Auto-logout in 30s
				</div>
				<div class="flex gap-2">
					<Button 
						variant="ghost" 
						size="sm"
						class="text-slate-300 hover:text-white"
						on:click={handleLogout}
					>
						Logout Now
					</Button>
					<Button 
						size="sm"
						class="bg-blue-600 hover:bg-blue-700"
						on:click={extendSession}
					>
						Stay Logged In
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.glass-card) {
		background-color: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	}
	
	:global(.glass) {
		background-color: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
</style>