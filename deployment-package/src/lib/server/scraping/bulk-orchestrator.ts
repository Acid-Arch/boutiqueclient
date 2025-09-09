/**
 * Bulk Scraping Orchestrator - Integrates HikerAPI, Session Management, and Error Recovery
 * Provides comprehensive orchestration for large-scale Instagram account scraping operations
 */

import { HikerAPIClient } from './hiker-api-client';
import { 
	createBulkSession, 
	getSessionById, 
	startSession,
	pauseSession,
	cancelSession,
	updateSessionProgress,
	getActiveProcessingSessions
} from './session-manager';
import { withErrorHandling, type ErrorContext } from './error-recovery';
import type { SessionData } from './session-manager';
// Import WebSocket notification functions (fallback if not available)
let notifySessionProgress: any;
let notifySessionComplete: any;
let notifyError: any;
let notifyCostUpdate: any;
let notifySessionStateChange: any;

// Initialize WebSocket functions asynchronously
async function initWebSocketFunctions() {
	try {
		const websocketModule = await import('../../../routes/api/scraping/websocket/+server');
		// Use dynamic property access to avoid TypeScript errors for potentially missing exports
		notifySessionProgress = (websocketModule as any).notifySessionProgress || ((id: string, data: any) => console.log(`[Progress] ${id}:`, data));
		notifySessionComplete = (websocketModule as any).notifySessionComplete || ((id: string, data: any) => console.log(`[Complete] ${id}:`, data));
		notifyError = (websocketModule as any).notifyError || ((id: string, error: any) => console.log(`[Error] ${id}:`, error));
		notifyCostUpdate = (websocketModule as any).notifyCostUpdate || ((id: string, data: any) => console.log(`[Cost] ${id}:`, data));
		notifySessionStateChange = (websocketModule as any).notifySessionStateChange || ((id: string, oldStatus: string, newStatus: string, reason?: string) => console.log(`[StateChange] ${id}: ${oldStatus} → ${newStatus}`, reason));
	} catch (error) {
		// Fallback functions if WebSocket module not available
		notifySessionProgress = (id: string, data: any) => console.log(`[Progress] ${id}:`, data);
		notifySessionComplete = (id: string, data: any) => console.log(`[Complete] ${id}:`, data);
		notifyError = (id: string, error: any) => console.log(`[Error] ${id}:`, error);
		notifyCostUpdate = (id: string, data: any) => console.log(`[Cost] ${id}:`, data);
		notifySessionStateChange = (id: string, from: string, to: string, reason: string) => console.log(`[State] ${id}: ${from} -> ${to} (${reason})`);
	}
}

export interface BulkScrapingConfig {
	sessionType: 'ACCOUNT_METRICS' | 'DETAILED_ANALYSIS' | 'FOLLOWERS_ANALYSIS';
	targetAccounts: string[];
	batchSize: number;
	maxConcurrentRequests: number;
	costLimit: number;
	priority: 'LOW' | 'NORMAL' | 'HIGH';
	scheduledFor?: Date;
	triggeredBy?: string;
	triggerSource?: string;
}

export interface BulkScrapingResult {
	sessionId: string;
	success: boolean;
	totalAccounts: number;
	processedAccounts: number;
	successfulAccounts: number;
	failedAccounts: number;
	skippedAccounts: number;
	totalRequestUnits: number;
	totalCost: number;
	duration: number;
	errors: Array<{
		accountId: string;
		error: string;
		timestamp: Date;
	}>;
}

export class BulkScrapingOrchestrator {
	private hikerClient: HikerAPIClient;
	private sessionManager: {
		pauseSession: (sessionId: string) => Promise<void>;
		cancelSession: (sessionId: string, reason: string) => Promise<void>;
		updateSessionProgress: (sessionId: string, progress: any) => Promise<void>;
	};
	
	constructor() {
		this.hikerClient = new HikerAPIClient();
		this.sessionManager = {
			pauseSession,
			cancelSession,
			updateSessionProgress
		};
	}
	
	/**
	 * Create and start a bulk scraping session
	 */
	async createSession(config: BulkScrapingConfig): Promise<string> {
		try {
			// Validate configuration
			this.validateConfig(config);
			
			// Create session in database
			const sessionId = await createBulkSession(
				config.sessionType,
				config.targetAccounts,
				{
					priority: config.priority,
					batchSize: config.batchSize,
					costLimit: config.costLimit,
					scheduledFor: config.scheduledFor,
					triggeredBy: config.triggeredBy,
					triggerSource: config.triggerSource
				}
			);
			
			console.log(`Created bulk scraping session: ${sessionId}`);
			return sessionId;
			
		} catch (error) {
			console.error('Failed to create bulk scraping session:', error);
			throw error;
		}
	}
	
	/**
	 * Execute a bulk scraping session
	 */
	async executeSession(sessionId: string): Promise<BulkScrapingResult> {
		const startTime = Date.now();
		let processedAccounts = 0;
		let successfulAccounts = 0;
		let failedAccounts = 0;
		let skippedAccounts = 0;
		let totalRequestUnits = 0;
		let totalCost = 0;
		const errors: Array<{accountId: string; error: string; timestamp: Date}> = [];
		
		try {
			// Get session details
			const session = await getSessionById(sessionId);
			if (!session) {
				throw new Error(`Session ${sessionId} not found`);
			}
			
			// Start the session
			await startSession(sessionId);
			console.log(`Started bulk scraping session: ${sessionId}`);
			
			// Notify WebSocket clients about session start
			notifySessionStateChange(sessionId, 'PENDING', 'IN_PROGRESS', 'Session started');
			
			// Get target accounts list (in real implementation, this would come from session data)
			const targetAccounts = await this.getSessionTargetAccounts(sessionId);
			
			// Process accounts in batches
			const batchSize = 5; // Could be configurable
			const batches = this.createBatches(targetAccounts, batchSize);
			
			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				const batch = batches[batchIndex];
				console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} accounts)`);
				
				// Process batch with concurrency control
				const batchResults = await this.processBatch(batch, session, batchIndex + 1);
				
				// Aggregate results
				batchResults.forEach(result => {
					processedAccounts++;
					if (result.success) {
						successfulAccounts++;
						totalRequestUnits += result.requestUnits || 0;
						totalCost += result.cost || 0;
					} else if (result.skipped) {
						skippedAccounts++;
					} else {
						failedAccounts++;
						errors.push({
							accountId: result.accountId,
							error: result.error || 'Unknown error',
							timestamp: new Date()
						});
					}
				});
				
				// Update session progress
				await updateSessionProgress(sessionId, {
					completedAccounts: successfulAccounts,
					failedAccounts,
					skippedAccounts,
					requestUnits: totalRequestUnits,
					actualCost: totalCost
				});
				
				// Send real-time progress updates
				const progress = Math.round((processedAccounts / targetAccounts.length) * 100);
				const estimatedTimeRemaining = this.calculateTimeRemaining(
					processedAccounts, 
					targetAccounts.length, 
					Date.now() - startTime
				);
				
				notifySessionProgress(sessionId, {
					progress,
					completedAccounts: successfulAccounts,
					failedAccounts,
					skippedAccounts,
					totalAccounts: targetAccounts.length,
					currentAccount: batch[batch.length - 1], // Last processed account in batch
					estimatedTimeRemaining,
					requestUnits: totalRequestUnits,
					actualCost: totalCost,
					status: 'IN_PROGRESS'
				});
				
				// Send cost updates
				notifyCostUpdate(sessionId, {
					requestUnits: totalRequestUnits,
					cost: totalCost,
					budgetUsed: (totalCost / session.estimatedCost) * 100,
					budgetRemaining: Math.max(0, session.estimatedCost - totalCost)
				});
				
				// Check if we should continue based on cost limits or errors
				if (totalCost >= session.estimatedCost * 1.5) {
					console.log(`Cost limit exceeded, stopping session ${sessionId}`);
					break;
				}
				
				// Rate limiting between batches
				if (batchIndex < batches.length - 1) {
					const delayMs = this.calculateBatchDelay(batchResults);
					if (delayMs > 0) {
						console.log(`Rate limiting: waiting ${delayMs}ms before next batch`);
						await new Promise(resolve => setTimeout(resolve, delayMs));
					}
				}
			}
			
			// Finalize session
			const duration = Date.now() - startTime;
			console.log(`Completed bulk scraping session ${sessionId} in ${duration}ms`);
			
			const result = {
				sessionId,
				success: true,
				totalAccounts: targetAccounts.length,
				processedAccounts,
				successfulAccounts,
				failedAccounts,
				skippedAccounts,
				totalRequestUnits,
				totalCost,
				duration,
				errors
			};
			
			// Notify completion via WebSocket
			notifySessionComplete(sessionId, result);
			
			return result;
			
		} catch (error) {
			console.error(`Bulk scraping session ${sessionId} failed:`, error);
			
			// Try to cancel the session
			try {
				await cancelSession(sessionId, error instanceof Error ? error.message : 'Unknown error');
			} catch (cancelError) {
				console.error(`Failed to cancel session ${sessionId}:`, cancelError);
			}
			
			return {
				sessionId,
				success: false,
				totalAccounts: 0,
				processedAccounts,
				successfulAccounts,
				failedAccounts,
				skippedAccounts,
				totalRequestUnits,
				totalCost,
				duration: Date.now() - startTime,
				errors: [
					...errors,
					{
						accountId: 'SYSTEM',
						error: error instanceof Error ? error.message : 'Unknown system error',
						timestamp: new Date()
					}
				]
			};
		}
	}
	
	/**
	 * Process a batch of accounts with error handling and recovery
	 */
	private async processBatch(
		accounts: string[],
		session: SessionData,
		batchNumber: number
	): Promise<Array<{
		accountId: string;
		success: boolean;
		skipped: boolean;
		requestUnits?: number;
		cost?: number;
		error?: string;
	}>> {
		const results = [];
		
		for (let i = 0; i < accounts.length; i++) {
			const accountId = accounts[i];
			console.log(`Processing account ${i + 1}/${accounts.length}: ${accountId}`);
			
			// Create error context
			const errorContext: ErrorContext = {
				sessionId: session.id,
				accountId,
				requestType: session.sessionType,
				attemptNumber: 1,
				totalAttempts: 3,
				consecutiveErrors: 0,
				sessionStartTime: session.startTime || new Date()
			};
			
			// Process account with error handling
			const result = await withErrorHandling(
				async () => {
					// Determine which API method to call based on session type
					switch (session.sessionType) {
						case 'ACCOUNT_METRICS':
							return await this.hikerClient.getUserProfile(accountId);
						case 'DETAILED_ANALYSIS':
							return await this.hikerClient.getUserProfile(accountId, { force: true });
						case 'FOLLOWERS_ANALYSIS':
							// Would implement followers analysis here
							return await this.hikerClient.getUserProfile(accountId);
						default:
							throw new Error(`Unknown session type: ${session.sessionType}`);
					}
				},
				errorContext,
				this.sessionManager
			);
			
			if (result.success) {
				results.push({
					accountId,
					success: true,
					skipped: false,
					requestUnits: result.data.requestUnits || 2,
					cost: result.data.metrics?.totalCost || 0.002
				});
			} else {
				// Check if this was a recoverable error that resulted in skipping
				const shouldSkip = result.recovery.strategy === 'SKIP';
				
				results.push({
					accountId,
					success: false,
					skipped: shouldSkip,
					error: result.error.message
				});
				
				// If session was paused or cancelled, break the batch
				if (['PAUSE_SESSION', 'CANCEL_SESSION'].includes(result.recovery.strategy)) {
					console.log(`Batch processing stopped due to: ${result.recovery.reason}`);
					break;
				}
			}
			
			// Small delay between accounts to prevent overwhelming the API
			if (i < accounts.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between accounts
			}
		}
		
		return results;
	}
	
	/**
	 * Create batches from target accounts
	 */
	private createBatches(accounts: string[], batchSize: number): string[][] {
		const batches = [];
		for (let i = 0; i < accounts.length; i += batchSize) {
			batches.push(accounts.slice(i, i + batchSize));
		}
		return batches;
	}
	
	/**
	 * Calculate delay between batches based on rate limiting
	 */
	private calculateBatchDelay(batchResults: any[]): number {
		// Basic rate limiting - could be enhanced based on API response headers
		const rateLimit = parseInt(process.env.HIKER_RATE_LIMIT_PER_SECOND || '11');
		const successfulRequests = batchResults.filter(r => r.success).length;
		
		if (successfulRequests >= rateLimit) {
			return 2000; // 2 seconds if we hit the rate limit
		}
		
		return 0; // No delay needed
	}
	
	/**
	 * Get target accounts for a session (placeholder - would be stored in session data)
	 */
	private async getSessionTargetAccounts(sessionId: string): Promise<string[]> {
		// In real implementation, this would fetch from session metadata or separate table
		// For now, return test accounts
		return ['therock', 'instagram', 'natgeo', 'cristiano', 'kyliejenner'];
	}
	
	/**
	 * Validate bulk scraping configuration
	 */
	private validateConfig(config: BulkScrapingConfig): void {
		if (!config.targetAccounts || config.targetAccounts.length === 0) {
			throw new Error('Target accounts list cannot be empty');
		}
		
		if (config.batchSize <= 0 || config.batchSize > 50) {
			throw new Error('Batch size must be between 1 and 50');
		}
		
		if (config.maxConcurrentRequests <= 0 || config.maxConcurrentRequests > 10) {
			throw new Error('Max concurrent requests must be between 1 and 10');
		}
		
		if (config.costLimit <= 0 || config.costLimit > 100) {
			throw new Error('Cost limit must be between $0.01 and $100.00');
		}
		
		const validSessionTypes = ['ACCOUNT_METRICS', 'DETAILED_ANALYSIS', 'FOLLOWERS_ANALYSIS'];
		if (!validSessionTypes.includes(config.sessionType)) {
			throw new Error(`Invalid session type. Must be one of: ${validSessionTypes.join(', ')}`);
		}
	}
	
	/**
	 * Calculate estimated time remaining for session completion
	 */
	private calculateTimeRemaining(
		processedAccounts: number, 
		totalAccounts: number, 
		elapsedTime: number
	): number {
		if (processedAccounts === 0) return 0;
		
		const averageTimePerAccount = elapsedTime / processedAccounts;
		const remainingAccounts = totalAccounts - processedAccounts;
		
		return Math.round((remainingAccounts * averageTimePerAccount) / 1000); // Return in seconds
	}
	
	/**
	 * Get status of all active bulk scraping sessions
	 */
	async getActiveSessions(): Promise<SessionData[]> {
		return await getActiveProcessingSessions(10);
	}
}

// Export singleton instance
export const bulkScrapingOrchestrator = new BulkScrapingOrchestrator();