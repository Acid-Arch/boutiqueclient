<script lang="ts">
	import { onMount } from 'svelte';
	import { notifications } from '$lib/api/websocket';
	import { toast } from 'svelte-sonner';
	import { Instagram, Activity, Smartphone, CheckCircle, AlertTriangle, Info, X } from 'lucide-svelte';

	$: notificationsList = $notifications;

	// Process new notifications and show toasts
	let lastNotificationCount = 0;
	
	$: {
		if (notificationsList.length > lastNotificationCount) {
			// New notification received
			const newNotifications = notificationsList.slice(lastNotificationCount);
			
			newNotifications.forEach(notification => {
				showNotificationToast(notification);
			});
			
			lastNotificationCount = notificationsList.length;
		}
	}

	function showNotificationToast(notification: any) {
		const { type, data, timestamp } = notification;
		
		switch (type) {
			case 'account:update':
				toast.success(`Account @${data.account.username} status changed to ${data.account.status}`, {
					description: `Updated ${new Date(timestamp).toLocaleTimeString()}`,
					duration: 4000,
					action: {
						label: 'View',
						onClick: () => {
							// Navigate to account details
							console.log('Navigate to account:', data.account.id);
						}
					}
				});
				break;
				
			case 'device:update':
				toast.info(`Device ${data.device.name} is now ${data.device.status}`, {
					description: `Updated ${new Date(timestamp).toLocaleTimeString()}`,
					duration: 4000
				});
				break;
				
			case 'system:status':
				if (data.level === 'error') {
					toast.error(data.title, {
						description: data.message,
						duration: 6000
					});
				} else if (data.level === 'warning') {
					toast.warning(data.title, {
						description: data.message,
						duration: 5000
					});
				} else {
					toast.info(data.title, {
						description: data.message,
						duration: 3000
					});
				}
				break;
				
			case 'notification':
				toast(data.title, {
					description: data.message,
					duration: 4000
				});
				break;
		}
	}

	onMount(() => {
		// Set initial count to avoid showing existing notifications as new
		lastNotificationCount = notificationsList.length;
	});
</script>

<!-- This component doesn't render anything visible - it just processes notifications -->
<!-- The actual toast UI is handled by svelte-sonner -->