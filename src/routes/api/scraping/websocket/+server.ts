// Minimal stub for removed websocket server functionality
// This prevents TypeScript import errors while maintaining fallback behavior

function notifySessionProgress(id: string, data: any) {
	console.log(`[Progress] ${id}:`, data);
}

function notifySessionComplete(id: string, data: any) {
	console.log(`[Complete] ${id}:`, data);
}

function notifyError(id: string, error: any) {
	console.log(`[Error] ${id}:`, error);
}

// Notification functions for WebSocket events
function notifyCostUpdate(id: string, data: any) {
	console.log(`[Cost] ${id}:`, data);
}

function notifySessionStateChange(id: string, oldStatus: string, newStatus: string, reason?: string) {
	console.log(`[StateChange] ${id}: ${oldStatus} → ${newStatus}`, reason);
}