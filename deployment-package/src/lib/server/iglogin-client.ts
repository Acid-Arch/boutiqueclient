/**
 * IGLoginAgent Service Client
 * 
 * This client provides a bridge between the BoutiquePortal SvelteKit backend
 * and the IGLoginAgent Python web service for managing Instagram automation sessions.
 */

import { dev } from '$app/environment';

export interface IGLoginConfig {
	accountId?: number;
	username?: string;
	deviceId?: string;
	cloneNumber?: number;
	packageName?: string;
	sessionType: 'login' | 'warmup' | 'combined';
	timeout?: number;
	customConfig?: Record<string, any>;
}

export interface IGSessionResponse {
	success: boolean;
	message: string;
	session_id?: string;
	data?: any;
	error?: string;
}

export interface IGSessionStatus {
	session_id: string;
	status: 'pending' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stopping';
	progress: number;
	message: string;
	start_time?: string;
	end_time?: string;
	error_message?: string;
	pid?: number;
	config: IGLoginConfig;
}

export interface IGLogEntry {
	timestamp: string;
	level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
	message: string;
	source: string;
	details?: Record<string, any>;
}

export interface IGHealthStatus {
	status: string;
	timestamp: string;
	version: string;
	active_sessions: number;
	database_connected: boolean;
}

class IGLoginAgentClient {
	private baseUrl: string;
	private timeout: number;

	constructor() {
		// Configure base URL based on environment
		this.baseUrl = dev 
			? 'http://localhost:8000'  // Development
			: process.env.IG_LOGIN_AGENT_URL || 'http://localhost:8000';
		
		this.timeout = 30000; // 30 second default timeout
	}

	/**
	 * Check if the IGLoginAgent service is healthy and accessible
	 */
	async checkHealth(): Promise<IGHealthStatus> {
		try {
			const response = await this.fetchWithTimeout('/health');
			
			if (!response.ok) {
				throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
			}
			
			return await response.json();
		} catch (error) {
			console.error('IGLoginAgent health check failed:', error);
			throw new Error(`Service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Start a new automation session
	 */
	async startSession(config: IGLoginConfig): Promise<IGSessionResponse> {
		try {
			const response = await this.fetchWithTimeout('/api/sessions/start', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					account_id: config.accountId,
					username: config.username,
					device_id: config.deviceId,
					clone_number: config.cloneNumber,
					package_name: config.packageName,
					session_type: config.sessionType,
					timeout: config.timeout || 1800,
					custom_config: config.customConfig || {}
				})
			});

			const result = await response.json();
			
			if (!response.ok) {
				throw new Error(result.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			return result;
		} catch (error) {
			console.error('Failed to start IGLoginAgent session:', error);
			throw new Error(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Stop an active session
	 */
	async stopSession(sessionId: string): Promise<IGSessionResponse> {
		try {
			const response = await this.fetchWithTimeout(`/api/sessions/${sessionId}/stop`, {
				method: 'POST'
			});

			const result = await response.json();
			
			if (!response.ok) {
				throw new Error(result.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			return result;
		} catch (error) {
			console.error(`Failed to stop IGLoginAgent session ${sessionId}:`, error);
			throw new Error(`Failed to stop session: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get the current status of a session
	 */
	async getSessionStatus(sessionId: string): Promise<IGSessionStatus> {
		try {
			const response = await this.fetchWithTimeout(`/api/sessions/${sessionId}/status`);
			
			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Session not found');
				}
				const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
				throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			return result.data;
		} catch (error) {
			console.error(`Failed to get IGLoginAgent session status for ${sessionId}:`, error);
			throw error;
		}
	}

	/**
	 * List all sessions, optionally filtered by account ID
	 */
	async listSessions(accountId?: number, limit = 50): Promise<IGSessionStatus[]> {
		try {
			const params = new URLSearchParams();
			if (accountId) params.set('account_id', accountId.toString());
			params.set('limit', limit.toString());

			const response = await this.fetchWithTimeout(`/api/sessions?${params}`);
			
			if (!response.ok) {
				const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
				throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			return result.data.sessions || [];
		} catch (error) {
			console.error('Failed to list IGLoginAgent sessions:', error);
			throw new Error(`Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Get logs for a specific session
	 */
	async getSessionLogs(sessionId: string, limit = 100): Promise<IGLogEntry[]> {
		try {
			const response = await this.fetchWithTimeout(`/api/sessions/${sessionId}/logs?limit=${limit}`);
			
			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Session not found');
				}
				const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
				throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			return result.data.logs || [];
		} catch (error) {
			console.error(`Failed to get IGLoginAgent session logs for ${sessionId}:`, error);
			throw error;
		}
	}

	/**
	 * Get account information from the IGLoginAgent database
	 */
	async getAccount(accountId: number): Promise<any> {
		try {
			const response = await this.fetchWithTimeout(`/api/accounts/${accountId}`);
			
			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Account not found');
				}
				const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
				throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			return result.data;
		} catch (error) {
			console.error(`Failed to get account ${accountId} from IGLoginAgent:`, error);
			throw error;
		}
	}

	/**
	 * List available accounts from the IGLoginAgent database
	 */
	async listAvailableAccounts(status = 'Unused'): Promise<any[]> {
		try {
			const params = new URLSearchParams();
			if (status) params.set('status', status);

			const response = await this.fetchWithTimeout(`/api/accounts?${params}`);
			
			if (!response.ok) {
				const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
				throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			return result.data.accounts || [];
		} catch (error) {
			console.error('Failed to list available accounts from IGLoginAgent:', error);
			throw new Error(`Failed to list accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Create WebSocket connection for real-time session updates
	 */
	createWebSocket(sessionId: string): WebSocket {
		const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
		return new WebSocket(`${wsUrl}/api/sessions/${sessionId}/ws`);
	}

	/**
	 * Helper method to handle HTTP requests with timeout
	 */
	private async fetchWithTimeout(path: string, options?: RequestInit): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.baseUrl}${path}`, {
				...options,
				signal: controller.signal,
				headers: {
					'Content-Type': 'application/json',
					...options?.headers
				}
			});

			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Request timeout after ${this.timeout}ms`);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Validate session configuration
	 */
	validateConfig(config: IGLoginConfig): string[] {
		const errors: string[] = [];

		if (!config.accountId && !config.username) {
			errors.push('Either accountId or username must be provided');
		}

		if (!['login', 'warmup', 'combined'].includes(config.sessionType)) {
			errors.push('sessionType must be one of: login, warmup, combined');
		}

		if (config.timeout && (config.timeout < 60 || config.timeout > 7200)) {
			errors.push('timeout must be between 60 and 7200 seconds');
		}

		if (config.cloneNumber && config.cloneNumber < 1) {
			errors.push('cloneNumber must be a positive integer');
		}

		return errors;
	}

	/**
	 * Convert session status from IGLoginAgent format to BoutiquePortal format
	 */
	convertSessionStatus(igStatus: IGSessionStatus): {
		id: string;
		accountId: number;
		sessionType: string;
		status: string;
		progress: number;
		message: string;
		startTime: Date | null;
		endTime: Date | null;
		errorMessage: string | null;
		deviceId: string | null;
		cloneNumber: number | null;
		packageName: string | null;
	} {
		return {
			id: igStatus.session_id,
			accountId: igStatus.config.accountId || 0,
			sessionType: igStatus.config.sessionType.toUpperCase(),
			status: igStatus.status.toUpperCase(),
			progress: typeof igStatus.progress === 'number' ? igStatus.progress : 0,
			message: igStatus.message || '',
			startTime: igStatus.start_time ? new Date(igStatus.start_time) : null,
			endTime: igStatus.end_time ? new Date(igStatus.end_time) : null,
			errorMessage: igStatus.error_message || null,
			deviceId: igStatus.config.deviceId || null,
			cloneNumber: igStatus.config.cloneNumber || null,
			packageName: igStatus.config.packageName || null
		};
	}
}

// Singleton instance
let igLoginClient: IGLoginAgentClient | null = null;

export function getIGLoginClient(): IGLoginAgentClient {
	if (!igLoginClient) {
		igLoginClient = new IGLoginAgentClient();
	}
	return igLoginClient;
}

/**
 * Health check utility function
 */
export async function checkIGLoginAgentHealth(): Promise<boolean> {
	try {
		const client = getIGLoginClient();
		const health = await client.checkHealth();
		return health.status === 'healthy';
	} catch (error) {
		console.error('IGLoginAgent health check failed:', error);
		return false;
	}
}

/**
 * Convenience function to start a login session
 */
export async function startLoginSession(accountId: number, deviceId?: string): Promise<string> {
	const client = getIGLoginClient();
	
	const config: IGLoginConfig = {
		accountId,
		deviceId,
		sessionType: 'login'
	};

	const errors = client.validateConfig(config);
	if (errors.length > 0) {
		throw new Error(`Invalid configuration: ${errors.join(', ')}`);
	}

	const response = await client.startSession(config);
	
	if (!response.success || !response.session_id) {
		throw new Error(response.error || 'Failed to start session');
	}

	return response.session_id;
}

/**
 * Convenience function to start a warmup session
 */
export async function startWarmupSession(accountId: number, deviceId?: string): Promise<string> {
	const client = getIGLoginClient();
	
	const config: IGLoginConfig = {
		accountId,
		deviceId,
		sessionType: 'warmup'
	};

	const errors = client.validateConfig(config);
	if (errors.length > 0) {
		throw new Error(`Invalid configuration: ${errors.join(', ')}`);
	}

	const response = await client.startSession(config);
	
	if (!response.success || !response.session_id) {
		throw new Error(response.error || 'Failed to start session');
	}

	return response.session_id;
}

/**
 * Convenience function to start a combined login + warmup session
 */
export async function startCombinedSession(accountId: number, deviceId?: string): Promise<string> {
	const client = getIGLoginClient();
	
	const config: IGLoginConfig = {
		accountId,
		deviceId,
		sessionType: 'combined'
	};

	const errors = client.validateConfig(config);
	if (errors.length > 0) {
		throw new Error(`Invalid configuration: ${errors.join(', ')}`);
	}

	const response = await client.startSession(config);
	
	if (!response.success || !response.session_id) {
		throw new Error(response.error || 'Failed to start session');
	}

	return response.session_id;
}