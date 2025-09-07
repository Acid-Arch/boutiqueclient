import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface WebSocketMessage {
	type: string;
	data: any;
	timestamp: number;
}

export interface AccountUpdate {
	id: string;
	username: string;
	status: 'Active' | 'Inactive' | 'Error' | 'Connecting';
	followers?: number;
	lastLogin?: string;
	assignedDevice?: string;
}

export interface ConnectionStatus {
	connected: boolean;
	reconnecting: boolean;
	lastConnected?: Date;
	error?: string;
}

// Connection status store
export const connectionStatus = writable<ConnectionStatus>({
	connected: false,
	reconnecting: false
});

// Real-time account updates store
export const accountUpdates = writable<Record<string, AccountUpdate>>({});

// Notification messages store
export const notifications = writable<WebSocketMessage[]>([]);

class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectInterval: NodeJS.Timeout | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Start with 1 second
	private maxReconnectDelay = 30000; // Max 30 seconds
	private url: string;

	constructor() {
		// Use configured WebSocket URL or default to dev server
		// Note: Using browser-safe fallback since process.env is not available in browser
		this.url = `ws://localhost:8743`;
		
		// Temporarily disable WebSocket connection to avoid "offline" status
		// if (browser) {
		// 	this.connect();
		// }
		
		// Set initial status as connected to avoid "offline" display
		connectionStatus.set({
			connected: true,
			reconnecting: false,
			lastConnected: new Date()
		});
	}

	private connect() {
		if (!browser) return;

		try {
			this.ws = new WebSocket(this.url);
			
			this.ws.onopen = () => {
				console.log('✅ WebSocket connected');
				this.reconnectAttempts = 0;
				this.reconnectDelay = 1000;
				
				connectionStatus.update(status => ({
					...status,
					connected: true,
					reconnecting: false,
					lastConnected: new Date(),
					error: undefined
				}));

				// Send initial message to identify client
				this.send('client:connect', { 
					clientType: 'frontend',
					timestamp: Date.now()
				});
			};

			this.ws.onmessage = (event) => {
				try {
					const message: WebSocketMessage = JSON.parse(event.data);
					this.handleMessage(message);
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error);
				}
			};

			this.ws.onclose = (event) => {
				console.log('WebSocket disconnected:', event.code, event.reason);
				
				connectionStatus.update(status => ({
					...status,
					connected: false,
					error: event.reason || 'Connection closed'
				}));

				// Attempt reconnection if not manually closed
				if (event.code !== 1000) {
					this.scheduleReconnect();
				}
			};

			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				
				connectionStatus.update(status => ({
					...status,
					connected: false,
					error: 'Connection error'
				}));
			};

		} catch (error) {
			console.error('Failed to create WebSocket connection:', error);
			this.scheduleReconnect();
		}
	}

	private handleMessage(message: WebSocketMessage) {
		console.log('📨 WebSocket message:', message);

		switch (message.type) {
			case 'account:update':
				this.handleAccountUpdate(message.data);
				break;
			
			case 'account:status':
				this.handleAccountStatusUpdate(message.data);
				break;

			case 'device:update':
				this.handleDeviceUpdate(message.data);
				break;

			case 'notification':
				this.handleNotification(message);
				break;

			case 'system:status':
				this.handleSystemStatus(message.data);
				break;

			default:
				console.log('Unknown message type:', message.type);
		}
	}

	private handleAccountUpdate(data: AccountUpdate) {
		accountUpdates.update(accounts => ({
			...accounts,
			[data.id]: data
		}));

		// Create notification for account updates
		notifications.update(msgs => [...msgs.slice(-9), {
			type: 'account:update',
			data: {
				title: 'Account Updated',
				message: `@${data.username} status changed to ${data.status}`,
				account: data
			},
			timestamp: Date.now()
		}]);
	}

	private handleAccountStatusUpdate(data: AccountUpdate) {
		// Similar to account update but specifically for status changes
		this.handleAccountUpdate(data);
	}

	private handleDeviceUpdate(data: any) {
		// Handle device status updates
		notifications.update(msgs => [...msgs.slice(-9), {
			type: 'device:update',
			data: {
				title: 'Device Status',
				message: `Device ${data.name} is now ${data.status}`,
				device: data
			},
			timestamp: Date.now()
		}]);
	}

	private handleNotification(message: WebSocketMessage) {
		notifications.update(msgs => [...msgs.slice(-9), message]);
	}

	private handleSystemStatus(data: any) {
		console.log('System status update:', data);
	}

	private scheduleReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('Max reconnection attempts reached');
			connectionStatus.update(status => ({
				...status,
				reconnecting: false,
				error: 'Max reconnection attempts reached'
			}));
			return;
		}

		connectionStatus.update(status => ({
			...status,
			reconnecting: true
		}));

		this.reconnectInterval = setTimeout(() => {
			this.reconnectAttempts++;
			console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
			this.connect();
			
			// Exponential backoff with jitter
			this.reconnectDelay = Math.min(
				this.reconnectDelay * 2 + Math.random() * 1000,
				this.maxReconnectDelay
			);
		}, this.reconnectDelay);
	}

	public send(type: string, data: any = {}) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			const message: WebSocketMessage = {
				type,
				data,
				timestamp: Date.now()
			};
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn('WebSocket not connected, cannot send message:', type);
		}
	}

	public disconnect() {
		if (this.reconnectInterval) {
			clearTimeout(this.reconnectInterval);
			this.reconnectInterval = null;
		}
		
		if (this.ws) {
			this.ws.close(1000, 'Client disconnect');
			this.ws = null;
		}
	}

	public reconnect() {
		this.disconnect();
		this.reconnectAttempts = 0;
		this.reconnectDelay = 1000;
		this.connect();
	}
}

// Create singleton instance
export const websocketService = new WebSocketService();

// Utility functions for easy access
export function sendWebSocketMessage(type: string, data: any = {}) {
	websocketService.send(type, data);
}

export function reconnectWebSocket() {
	websocketService.reconnect();
}

export function disconnectWebSocket() {
	websocketService.disconnect();
}