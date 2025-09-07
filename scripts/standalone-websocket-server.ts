#!/usr/bin/env node
import { WebSocketServer } from 'ws';

const PORT = 8743;

const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket server started on port ${PORT}`);
console.log(`📡 URL: ws://localhost:${PORT}`);

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
	console.log(`✅ Client connected from ${req.socket.remoteAddress}`);
	clients.add(ws);

	// Send welcome message
	ws.send(JSON.stringify({
		type: 'system:status',
		data: {
			level: 'info',
			title: 'Connected',
			message: 'WebSocket connection established successfully'
		},
		timestamp: Date.now()
	}));

	ws.on('message', (data) => {
		try {
			const message = JSON.parse(data.toString());
			console.log(`📨 Received message:`, message);

			handleMessage(ws, message);
		} catch (error) {
			console.error('❌ Failed to parse message:', error);
		}
	});

	ws.on('close', (code, reason) => {
		console.log(`👋 Client disconnected: ${code} ${reason}`);
		clients.delete(ws);
	});

	ws.on('error', (error) => {
		console.error('❌ WebSocket error:', error);
		clients.delete(ws);
	});
});

function handleMessage(ws: any, message: any) {
	const { type, data } = message;

	switch (type) {
		case 'client:connect':
			console.log(`🔗 Client identified as: ${data.clientType}`);
			// Send some mock account updates
			setTimeout(() => {
				sendAccountUpdate(ws, '1', 'Connecting');
			}, 1000);
			setTimeout(() => {
				sendAccountUpdate(ws, '1', 'Active');
			}, 3000);
			setTimeout(() => {
				sendAccountUpdate(ws, '2', 'Error');
			}, 5000);
			break;

		case 'account:refresh':
			console.log(`🔄 Account refresh requested for IDs: ${data.accountIds?.join(', ')}`);
			// Simulate refreshing accounts
			data.accountIds?.forEach((id: string, index: number) => {
				setTimeout(() => {
					const statuses = ['Active', 'Inactive', 'Error', 'Connecting'];
					const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
					sendAccountUpdate(ws, id, randomStatus);
				}, (index + 1) * 1000);
			});
			break;

		case 'account:created':
			console.log(`✨ New account created: @${data.username}`);
			// Broadcast to all clients
			broadcastToAll({
				type: 'notification',
				data: {
					title: 'New Account Added',
					message: `Account @${data.username} has been added to the system`
				},
				timestamp: Date.now()
			});
			break;

		default:
			console.log(`❓ Unknown message type: ${type}`);
	}
}

function sendAccountUpdate(ws: any, accountId: string, status: string) {
	const message = {
		type: 'account:update',
		data: {
			id: accountId,
			username: `test_user_${accountId}`,
			status,
			followers: Math.floor(Math.random() * 50000) + 1000,
			lastLogin: new Date().toISOString(),
			assignedDevice: Math.random() > 0.5 ? `Device-${String(Math.floor(Math.random() * 3) + 1).padStart(3, '0')}` : null
		},
		timestamp: Date.now()
	};

	ws.send(JSON.stringify(message));
}

function broadcastToAll(message: any) {
	const messageStr = JSON.stringify(message);
	clients.forEach((client: any) => {
		if (client.readyState === client.OPEN) {
			client.send(messageStr);
		}
	});
}

// Send periodic updates
setInterval(() => {
	// Randomly update an account
	const accountIds = ['1', '2', '3', '4'];
	const randomId = accountIds[Math.floor(Math.random() * accountIds.length)];
	const statuses = ['Active', 'Inactive'];
	const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

	clients.forEach((client: any) => {
		if (client.readyState === client.OPEN) {
			sendAccountUpdate(client, randomId, randomStatus);
		}
	});
}, 15000); // Every 15 seconds

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n🛑 Shutting down WebSocket server...');
	wss.close(() => {
		console.log('✅ WebSocket server closed');
		process.exit(0);
	});
});

process.on('SIGTERM', () => {
	console.log('\n🛑 Shutting down WebSocket server...');
	wss.close(() => {
		console.log('✅ WebSocket server closed');
		process.exit(0);
	});
});