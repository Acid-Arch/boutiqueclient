import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bulkScrapingOrchestrator } from '$lib/server/scraping/bulk-orchestrator';
import { validateErrorRecoverySystem } from '$lib/server/scraping/error-recovery';
import type { BulkScrapingConfig } from '$lib/server/scraping/bulk-orchestrator';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action');
		
		switch (action) {
			case 'health':
				// Health check for bulk scraping system
				const errorSystemHealth = validateErrorRecoverySystem();
				return json({
					success: true,
					health: {
						bulkOrchestrator: 'operational',
						errorRecovery: errorSystemHealth,
						timestamp: new Date().toISOString()
					}
				});
			
			case 'active-sessions':
				// Get all active bulk scraping sessions
				const activeSessions = await bulkScrapingOrchestrator.getActiveSessions();
				return json({
					success: true,
					activeSessions,
					count: activeSessions.length
				});
			
			default:
				return json(
					{ success: false, error: 'Invalid action. Use: health, active-sessions' },
					{ status: 400 }
				);
		}
		
	} catch (error) {
		console.error('Bulk scraping API error:', error);
		return json(
			{ 
				success: false,
				error: 'Failed to process bulk scraping request',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { action } = data;
		
		switch (action) {
			case 'create-session':
				// Create a new bulk scraping session
				const config: BulkScrapingConfig = {
					sessionType: data.sessionType || 'ACCOUNT_METRICS',
					targetAccounts: data.targetAccounts || [],
					batchSize: data.batchSize || 5,
					maxConcurrentRequests: data.maxConcurrentRequests || 3,
					costLimit: data.costLimit || 5.0,
					priority: data.priority || 'NORMAL',
					scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
					triggeredBy: data.triggeredBy || 'USER',
					triggerSource: data.triggerSource || 'MANUAL'
				};
				
				const sessionId = await bulkScrapingOrchestrator.createSession(config);
				
				return json({
					success: true,
					sessionId,
					message: 'Bulk scraping session created successfully',
					config: {
						...config,
						scheduledFor: config.scheduledFor?.toISOString()
					}
				});
			
			case 'execute-session':
				// Execute a bulk scraping session
				if (!data.sessionId) {
					return json(
						{ success: false, error: 'Session ID is required' },
						{ status: 400 }
					);
				}
				
				// Execute session asynchronously (in real implementation, this might be queued)
				const result = await bulkScrapingOrchestrator.executeSession(data.sessionId);
				
				return json({
					success: true,
					result,
					message: result.success ? 
						'Bulk scraping session completed successfully' : 
						'Bulk scraping session completed with errors'
				});
			
			case 'create-and-execute':
				// Create and immediately execute a bulk scraping session
				const createConfig: BulkScrapingConfig = {
					sessionType: data.sessionType || 'ACCOUNT_METRICS',
					targetAccounts: data.targetAccounts || [],
					batchSize: data.batchSize || 5,
					maxConcurrentRequests: data.maxConcurrentRequests || 3,
					costLimit: data.costLimit || 5.0,
					priority: data.priority || 'HIGH', // Higher priority for immediate execution
					triggeredBy: data.triggeredBy || 'USER',
					triggerSource: data.triggerSource || 'MANUAL'
				};
				
				// Validate required fields
				if (!createConfig.targetAccounts || createConfig.targetAccounts.length === 0) {
					return json(
						{ success: false, error: 'Target accounts list is required and cannot be empty' },
						{ status: 400 }
					);
				}
				
				// Create session
				const newSessionId = await bulkScrapingOrchestrator.createSession(createConfig);
				
				// Execute immediately
				const executeResult = await bulkScrapingOrchestrator.executeSession(newSessionId);
				
				return json({
					success: true,
					sessionId: newSessionId,
					result: executeResult,
					message: executeResult.success ? 
						'Bulk scraping session created and completed successfully' : 
						'Bulk scraping session created but completed with errors',
					summary: {
						totalAccounts: executeResult.totalAccounts,
						successfulAccounts: executeResult.successfulAccounts,
						failedAccounts: executeResult.failedAccounts,
						skippedAccounts: executeResult.skippedAccounts,
						totalCost: executeResult.totalCost,
						duration: executeResult.duration,
						errorCount: executeResult.errors.length
					}
				});
			
			case 'test-integration':
				// Test the integration with sample data
				const testConfig: BulkScrapingConfig = {
					sessionType: 'ACCOUNT_METRICS',
					targetAccounts: ['therock', 'instagram', 'natgeo'],
					batchSize: 2,
					maxConcurrentRequests: 2,
					costLimit: 1.0,
					priority: 'NORMAL',
					triggeredBy: 'SYSTEM_TEST',
					triggerSource: 'API'
				};
				
				// Create test session
				const testSessionId = await bulkScrapingOrchestrator.createSession(testConfig);
				
				// For testing, don't execute immediately - just return session info
				return json({
					success: true,
					message: 'Integration test successful - session created',
					testSessionId,
					testConfig,
					nextStep: `Use POST /api/scraping/bulk with action: execute-session and sessionId: ${testSessionId} to run the test`
				});
			
			default:
				return json(
					{ 
						success: false, 
						error: 'Invalid action. Available actions: create-session, execute-session, create-and-execute, test-integration'
					},
					{ status: 400 }
				);
		}
		
	} catch (error) {
		console.error('Bulk scraping POST API error:', error);
		return json(
			{ 
				success: false,
				error: 'Failed to process bulk scraping request',
				details: error instanceof Error ? error.message : 'Unknown error'
			}, 
			{ status: 500 }
		);
	}
};