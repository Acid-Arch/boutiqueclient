/**
 * Daily Scraping Scheduler API Endpoint
 * Manages daily scraping automation and testing
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDailyScheduler } from '$lib/server/scraping/daily-scheduler.js';
import { getClientAccountStats, getClientAccountSample } from '$lib/server/scraping/client-account-filter.js';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const action = url.searchParams.get('action') || 'status';
    const scheduler = getDailyScheduler();

    switch (action) {
      case 'status':
        // Get scheduler status and statistics
        const stats = await scheduler.getSchedulerStats();
        const config = scheduler.getConfig();
        const clientStats = await getClientAccountStats();
        
        return json({
          success: true,
          data: {
            scheduler: {
              enabled: config.enabled,
              testMode: config.testMode,
              cronSchedule: config.cronSchedule,
              maxAccountsPerDay: config.maxAccountsPerDay,
              costLimit: config.costLimit,
              isRunning: scheduler.getRunningStatus()
            },
            stats: stats,
            clientAccounts: clientStats
          }
        });

      case 'test-accounts':
        // Get sample accounts for testing
        const limit = parseInt(url.searchParams.get('limit') || '5');
        const sampleAccounts = await getClientAccountSample(limit);
        
        return json({
          success: true,
          data: {
            sampleAccounts: sampleAccounts.map(account => ({
              id: account.id,
              username: account.username,
              email: account.email,
              ownerId: account.ownerId,
              accountType: account.accountType,
              currentStatus: account.currentStatus,
              isCompanyAccount: account.email?.includes('@op.pl') || false
            })),
            totalSampled: sampleAccounts.length
          }
        });

      case 'config':
        // Get current configuration
        return json({
          success: true,
          data: {
            config: scheduler.getConfig()
          }
        });

      default:
        return json({
          success: false,
          error: 'Invalid action. Valid actions: status, test-accounts, config'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Daily scheduler API error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action, config } = await request.json();
    const scheduler = getDailyScheduler();

    switch (action) {
      case 'start':
        // Start the scheduler
        scheduler.start();
        return json({
          success: true,
          message: 'Daily scheduler started'
        });

      case 'stop':
        // Stop the scheduler
        scheduler.stop();
        return json({
          success: true,
          message: 'Daily scheduler stopped'
        });

      case 'trigger':
        // Manually trigger scraping (for testing)
        if (scheduler.getRunningStatus()) {
          return json({
            success: false,
            error: 'Scraping session is already running'
          }, { status: 409 });
        }

        // Trigger manual scraping in background
        scheduler.triggerManualScraping().catch(console.error);
        
        return json({
          success: true,
          message: 'Manual scraping session triggered'
        });

      case 'update-config':
        // Update scheduler configuration
        if (!config) {
          return json({
            success: false,
            error: 'Configuration object is required'
          }, { status: 400 });
        }

        scheduler.updateConfig(config);
        return json({
          success: true,
          message: 'Configuration updated',
          data: {
            updatedConfig: scheduler.getConfig()
          }
        });

      case 'test-setup':
        // Set up optimal test configuration
        const testConfig = {
          enabled: true,
          testMode: true,
          testAccountLimit: 3,
          costLimit: 0.01, // $0.01 for testing
          maxAccountsPerDay: 5,
          cronSchedule: "*/5 * * * *" // Every 5 minutes for testing
        };

        scheduler.updateConfig(testConfig);
        return json({
          success: true,
          message: 'Test configuration applied',
          data: {
            testConfig: testConfig
          }
        });

      case 'production-setup':
        // Set up production configuration
        const prodConfig = {
          enabled: true,
          testMode: false,
          maxAccountsPerDay: 100,
          costLimit: 0.20, // $0.20 daily
          cronSchedule: "0 9 * * *", // 9 AM daily
          prioritizeOwnedAccounts: true
        };

        scheduler.updateConfig(prodConfig);
        return json({
          success: true,
          message: 'Production configuration applied',
          data: {
            productionConfig: prodConfig
          }
        });

      default:
        return json({
          success: false,
          error: 'Invalid action. Valid actions: start, stop, trigger, update-config, test-setup, production-setup'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Daily scheduler API error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};