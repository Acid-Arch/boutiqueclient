// Minimal stub for removed websocket server functionality
// This prevents TypeScript import errors while maintaining fallback behavior

export function notifySessionProgress(id: string, data: any) {
	console.log(`[Progress] ${id}:`, data);
}

export function notifySessionComplete(id: string, data: any) {
	console.log(`[Complete] ${id}:`, data);
}

export function notifyError(id: string, error: any) {
	console.log(`[Error] ${id}:`, error);
}

export function notifyCostUpdate(id: string, data: any) {
	console.log(`[Cost] ${id}:`, data);
}

export function notifySessionStateChange(id: string, oldStatus: string, newStatus: string, reason?: string) {
	console.log(`[StateChange] ${id}: ${oldStatus} → ${newStatus}`, reason);
}