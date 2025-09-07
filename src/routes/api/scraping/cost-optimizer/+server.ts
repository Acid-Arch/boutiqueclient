/**
 * Cost Optimization API Endpoint
 * Test and configure cost-optimized scraping
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CostOptimizer, COST_OPTIMIZATION_PRESETS } from '$lib/server/scraping/cost-optimizer.js';
import { getClientAccountStats } from '$lib/server/scraping/client-account-filter.js';

// Global cost optimizer instance
let globalOptimizer: CostOptimizer | null = null;

function getCostOptimizer(): CostOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new CostOptimizer('TEST_MODE'); // Start in test mode
  }
  return globalOptimizer;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const action = url.searchParams.get('action') || 'analyze';
    const optimizer = getCostOptimizer();

    switch (action) {
      case 'analyze':
        // Analyze costs for current account base
        const accountStats = await getClientAccountStats();
        const costAnalysis = optimizer.analyzeCosts(accountStats.eligibleForScraping);
        
        return json({
          success: true,
          data: {
            accountStats,
            costAnalysis,
            currentConfig: optimizer.getConfig(),
            optimalParams: optimizer.getOptimalScrapingParams(accountStats.eligibleForScraping)
          }
        });

      case 'rate-limit':
        // Check current rate limiting status
        const rateLimitStatus = optimizer.checkRateLimit();
        
        return json({
          success: true,
          data: {
            rateLimitStatus,
            canProceed: !rateLimitStatus.isRateLimited,
            recommendedDelay: rateLimitStatus.suggestedDelay
          }
        });

      case 'presets':
        // Get available cost optimization presets
        const presets = Object.keys(COST_OPTIMIZATION_PRESETS).map(key => ({
          name: key,
          config: COST_OPTIMIZATION_PRESETS[key as keyof typeof COST_OPTIMIZATION_PRESETS],
          description: getPresetDescription(key)
        }));
        
        return json({
          success: true,
          data: { presets }
        });

      case 'recommendations':
        // Get cost savings recommendations
        const currentSpending = parseFloat(url.searchParams.get('spending') || '0');
        const recommendations = optimizer.getCostSavingsRecommendations(currentSpending);
        
        return json({
          success: true,
          data: {
            currentSpending,
            recommendations,
            configValidation: optimizer.validateConfig()
          }
        });

      case 'validate':
        // Validate current configuration
        const validation = optimizer.validateConfig();
        
        return json({
          success: true,
          data: {
            validation,
            currentConfig: optimizer.getConfig()
          }
        });

      default:
        return json({
          success: false,
          error: 'Invalid action. Valid actions: analyze, rate-limit, presets, recommendations, validate'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Cost optimizer API error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action, preset, config } = await request.json();
    const optimizer = getCostOptimizer();

    switch (action) {
      case 'apply-preset':
        // Apply a cost optimization preset
        if (!preset || !COST_OPTIMIZATION_PRESETS[preset as keyof typeof COST_OPTIMIZATION_PRESETS]) {
          return json({
            success: false,
            error: 'Invalid preset. Valid presets: ' + Object.keys(COST_OPTIMIZATION_PRESETS).join(', ')
          }, { status: 400 });
        }

        optimizer.applyPreset(preset);
        return json({
          success: true,
          message: `Applied preset: ${preset}`,
          data: {
            newConfig: optimizer.getConfig(),
            validation: optimizer.validateConfig()
          }
        });

      case 'update-config':
        // Update specific configuration parameters
        if (!config) {
          return json({
            success: false,
            error: 'Configuration object is required'
          }, { status: 400 });
        }

        optimizer.updateConfig(config);
        const validation = optimizer.validateConfig();
        
        return json({
          success: true,
          message: 'Configuration updated',
          data: {
            updatedConfig: optimizer.getConfig(),
            validation
          }
        });

      case 'record-request':
        // Record a request for rate limiting tracking
        optimizer.recordRequest();
        const newRateLimit = optimizer.checkRateLimit();
        
        return json({
          success: true,
          message: 'Request recorded',
          data: {
            rateLimitStatus: newRateLimit
          }
        });

      case 'test-scenarios':
        // Test different cost scenarios
        const scenarios = await generateTestScenarios(optimizer);
        
        return json({
          success: true,
          data: { scenarios }
        });

      default:
        return json({
          success: false,
          error: 'Invalid action. Valid actions: apply-preset, update-config, record-request, test-scenarios'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Cost optimizer API error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

function getPresetDescription(presetKey: string): string {
  const descriptions = {
    TEST_MODE: 'Ultra conservative settings for testing with minimal cost ($0.01/day)',
    SMALL_SCALE: 'Moderate budget for small clients with careful cost control ($0.05/day)',
    PRODUCTION: 'Higher budget for regular production use ($0.20/day)',
    ENTERPRISE: 'Maximum scale for enterprise with full account coverage ($1.00/day)'
  };
  
  return descriptions[presetKey as keyof typeof descriptions] || 'Custom configuration';
}

async function generateTestScenarios(optimizer: CostOptimizer) {
  const accountStats = await getClientAccountStats();
  const scenarios = [];

  // Scenario 1: Current configuration
  const currentAnalysis = optimizer.analyzeCosts(accountStats.eligibleForScraping);
  scenarios.push({
    name: 'Current Configuration',
    config: optimizer.getConfig(),
    analysis: currentAnalysis,
    optimalParams: optimizer.getOptimalScrapingParams(accountStats.eligibleForScraping)
  });

  // Scenario 2: Test each preset
  for (const [presetName, presetConfig] of Object.entries(COST_OPTIMIZATION_PRESETS)) {
    const testOptimizer = new CostOptimizer();
    testOptimizer.updateConfig(presetConfig);
    
    scenarios.push({
      name: `${presetName} Preset`,
      config: presetConfig,
      analysis: testOptimizer.analyzeCosts(accountStats.eligibleForScraping),
      optimalParams: testOptimizer.getOptimalScrapingParams(accountStats.eligibleForScraping)
    });
  }

  return scenarios;
}