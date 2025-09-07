<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { LogIn, Shield, Users, BarChart3, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let mounted = false;
	let loginMethod = 'oauth'; // 'oauth' or 'email'
	let showPassword = false;
	let isLoading = false;
	let loginError = '';

	// Form fields
	let email = 'jorge.test@gmail.com';
	let password = 'testpassword123';

	// Get any error from URL params
	$: error = $page.url.searchParams.get('error') || $page.url.searchParams.get('reason');

	onMount(() => {
		mounted = true;
	});

	async function handleGoogleSignIn() {
		try {
			await signIn('google', { callbackUrl: '/client-portal' });
		} catch (error) {
			console.error('OAuth signin error:', error);
			loginError = 'OAuth signin failed. Please try again.';
		}
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	async function handleEmailLogin() {
		if (!email || !password) {
			loginError = 'Please fill in all fields';
			return;
		}

		isLoading = true;
		loginError = '';

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ emailOrUsername: email, password })
			});

			const result = await response.json();

			if (result.success) {
				// Redirect to client portal
				window.location.href = '/client-portal';
			} else {
				loginError = result.error || 'Login failed';
			}
		} catch (err) {
			loginError = 'Network error. Please try again.';
			console.error('Login error:', err);
		} finally {
			isLoading = false;
		}
	}

	function switchLoginMethod() {
		loginMethod = loginMethod === 'oauth' ? 'email' : 'oauth';
		loginError = '';
		email = '';
		password = '';
	}
</script>

<svelte:head>
	<title>Login - Client Portal</title>
	<meta name="description" content="Login to your Client Portal" />
</svelte:head>

{#if mounted}
	<div class="min-h-screen flex items-center justify-center p-4">
		<div class="w-full max-w-md space-y-6">
			<!-- Logo/Brand -->
			<div class="text-center">
				<h1 class="text-4xl font-bold text-white mb-2">
					✨ Client Portal
				</h1>
				<p class="text-slate-300">
					Manage your Instagram accounts with ease
				</p>
			</div>

			<!-- Login Card -->
			<Card class="glass-card border-white/10">
				<CardHeader class="space-y-1 text-center">
					<CardTitle class="text-2xl text-white">Welcome Back</CardTitle>
					<p class="text-slate-300">Sign in to access your dashboard</p>
				</CardHeader>
				<CardContent class="space-y-4">
					{#if error || loginError}
						<div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
							<p class="text-red-400 text-sm">
								{loginError || (error === 'OAuthAccountNotLinked' 
									? 'Email already in use with different provider'
									: 'Authentication failed. Please try again.')}
							</p>
						</div>
					{/if}

					{#if loginMethod === 'oauth'}
						<!-- Google Sign In -->
						<Button 
							onclick={handleGoogleSignIn}
							class="w-full bg-white hover:bg-gray-50 text-gray-900 font-medium"
							disabled={isLoading}
						>
							<svg class="w-5 h-5 mr-3" viewBox="0 0 24 24">
								<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
								<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
								<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
								<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
							</svg>
							Continue with Google
						</Button>

						<!-- Divider -->
						<div class="relative">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-white/10"></div>
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="bg-transparent px-2 text-slate-400">Or continue with email</span>
							</div>
						</div>

						<!-- Switch to Email Login -->
						<Button 
							variant="outline"
							onclick={switchLoginMethod}
							class="w-full border-white/20 text-white hover:bg-white/10 bg-transparent"
						>
							<Mail class="w-4 h-4 mr-2" />
							Sign in with Email
						</Button>

					{:else}
						<!-- Email Login Form -->
						<form on:submit|preventDefault={handleEmailLogin} class="space-y-4">
							<div>
								<Label for="email" class="text-slate-300">Email Address</Label>
								<Input
									id="email"
									type="email"
									bind:value={email}
									placeholder="Enter your email"
									required
									class="bg-white/5 border-white/20 text-white placeholder:text-slate-400"
								/>
							</div>
							
							<div>
								<Label for="password" class="text-slate-300">Password</Label>
								<div class="relative">
									<Input
										id="password"
										type={showPassword ? 'text' : 'password'}
										bind:value={password}
										placeholder="Enter your password"
										required
										class="bg-white/5 border-white/20 text-white placeholder:text-slate-400 pr-10"
									/>
									<button
										type="button"
										on:click={togglePasswordVisibility}
										class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
									>
										<svelte:component this={showPassword ? EyeOff : Eye} class="h-4 w-4" />
									</button>
								</div>
							</div>

							<Button 
								type="submit"
								disabled={isLoading || !email || !password}
								class="w-full bg-blue-600 hover:bg-blue-700 text-white"
							>
								{#if isLoading}
									<Loader2 class="w-4 h-4 mr-2 animate-spin" />
									Signing in...
								{:else}
									<LogIn class="w-4 h-4 mr-2" />
									Sign In
								{/if}
							</Button>
						</form>

						<!-- Divider -->
						<div class="relative">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-white/10"></div>
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="bg-transparent px-2 text-slate-400">Or continue with Google</span>
							</div>
						</div>

						<!-- Switch to OAuth -->
						<Button 
							variant="outline"
							onclick={switchLoginMethod}
							class="w-full border-white/20 text-white hover:bg-white/10 bg-transparent"
						>
							<svg class="w-4 h-4 mr-2" viewBox="0 0 24 24">
								<path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
								<path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
								<path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
								<path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
							</svg>
							Back to Google Sign In
						</Button>
					{/if}

					<!-- Features -->
					<div class="pt-4 space-y-3">
						<div class="flex items-center text-sm text-slate-300">
							<Users class="w-4 h-4 mr-2 text-blue-400" />
							Manage Instagram accounts
						</div>
						<div class="flex items-center text-sm text-slate-300">
							<BarChart3 class="w-4 h-4 mr-2 text-green-400" />
							Analytics and insights
						</div>
						<div class="flex items-center text-sm text-slate-300">
							<Shield class="w-4 h-4 mr-2 text-blue-400" />
							Secure and reliable
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Footer -->
			<div class="text-center text-sm text-slate-400">
				<p>Secure login powered by Google OAuth</p>
			</div>
		</div>
	</div>
{/if}