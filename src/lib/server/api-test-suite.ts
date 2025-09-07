/**
 * API Reliability Test Suite
 * 
 * Comprehensive testing utility for all automation API endpoints
 * to verify reliability, error handling, and graceful degradation.
 */

interface ApiTestResult {
	endpoint: string;
	method: string;
	status: 'success' | 'error' | 'timeout' | 'fallback';
	responseTime: number;
	statusCode: number;
	dataSource?: string;
	errorCode?: string;
	fallbackUsed?: boolean;
	retryAttempts?: number;
}

interface ApiEndpoint {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	params: URLSearchParams;
	expectsData: boolean;
	critical: boolean;
	body?: any;
	expectedError?: string;
}

interface TestSuiteResults {
	totalTests: number;
	passed: number;
	failed: number;
	warnings: number;
	averageResponseTime: number;
	reliabilityScore: number;
	results: ApiTestResult[];
	summary: {
		fastResponses: number; // < 1000ms
		slowResponses: number; // > 5000ms
		timeouts: number;
		fallbacksUsed: number;
		databaseErrors: number;
	};
}

// Test configuration
const TEST_CONFIG = {
	BASE_URL: 'http://localhost:5173',
	TIMEOUT_MS: 20000,
	SLOW_RESPONSE_THRESHOLD: 5000,
	FAST_RESPONSE_THRESHOLD: 1000,
	RETRY_ATTEMPTS: 2
} as const;

// Test endpoints with their expected behavior
const API_ENDPOINTS: ApiEndpoint[] = [
	{
		path: '/api/automation/overview',
		method: 'GET',
		params: new URLSearchParams(),
		expectsData: true,
		critical: true
	},
	{
		path: '/api/automation/overview',
		method: 'GET', 
		params: new URLSearchParams({ metrics: 'true', health: 'true', ready: 'true' }),
		expectsData: true,
		critical: true
	},
	{
		path: '/api/automation/analytics',
		method: 'GET',
		params: new URLSearchParams({ timeRange: '24h' }),
		expectsData: true,
		critical: true
	},
	{
		path: '/api/automation/analytics',
		method: 'GET',
		params: new URLSearchParams({ timeRange: '7d', advanced: 'true' }),
		expectsData: true,
		critical: false
	},
	{
		path: '/api/automation/bulk/status',
		method: 'GET',
		params: new URLSearchParams({ limit: '10' }),
		expectsData: true,
		critical: true
	},
	{
		path: '/api/automation/bulk/status',
		method: 'POST',
		params: new URLSearchParams(),
		body: { limit: 5, includeProgress: true },
		expectsData: true,
		critical: true
	},
	{
		path: '/api/automation/logs/1',
		method: 'GET',
		params: new URLSearchParams({ limit: '20' }),
		expectsData: false, // May not have data
		critical: false
	},
	{
		path: '/api/automation/status/1',
		method: 'GET',
		params: new URLSearchParams(),
		expectsData: false,
		critical: false
	}
] as const;

/**
 * Make API request with timeout and retry
 */
async function makeApiRequest(
	endpoint: ApiEndpoint,
	attempt = 1
): Promise<ApiTestResult> {
	const startTime = Date.now();
	const url = endpoint.params.toString() 
		? `${TEST_CONFIG.BASE_URL}${endpoint.path}?${endpoint.params.toString()}`
		: `${TEST_CONFIG.BASE_URL}${endpoint.path}`;

	try {
		const requestOptions: RequestInit = {
			method: endpoint.method,
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(TEST_CONFIG.TIMEOUT_MS)
		};

		if (endpoint.method === 'POST' && 'body' in endpoint) {
			requestOptions.body = JSON.stringify(endpoint.body);
		}

		const response = await fetch(url, requestOptions);
		const responseTime = Date.now() - startTime;
		
		let responseData;
		try {
			responseData = await response.json();
		} catch {
			responseData = {};
		}

		// Analyze response
		const result: ApiTestResult = {
			endpoint: endpoint.path,
			method: endpoint.method,
			status: response.ok ? 'success' : 'error',
			responseTime,
			statusCode: response.status,
			dataSource: responseData.dataSource || 'unknown',
			fallbackUsed: responseData.dataSource === 'fallback',
			retryAttempts: attempt
		};

		// Check for error codes
		if (!response.ok) {
			result.errorCode = responseData.code || `HTTP_${response.status}`;
		}

		// Check if fallback was used successfully
		if (responseData.dataSource === 'fallback' && response.ok) {
			result.status = 'fallback';
		}

		return result;

	} catch (error) {
		const responseTime = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Determine if this is a timeout or other error
		const isTimeout = errorMessage.includes('timeout') || 
						  errorMessage.includes('aborted') ||
						  responseTime >= TEST_CONFIG.TIMEOUT_MS - 1000;

		// Retry on timeout or network errors if not last attempt
		if ((isTimeout || errorMessage.includes('fetch')) && attempt < TEST_CONFIG.RETRY_ATTEMPTS) {
			console.log(`[API Test] Retrying ${endpoint.path} (attempt ${attempt + 1})`);
			await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
			return makeApiRequest(endpoint, attempt + 1);
		}

		return {
			endpoint: endpoint.path,
			method: endpoint.method,
			status: isTimeout ? 'timeout' : 'error',
			responseTime,
			statusCode: 0,
			errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
			retryAttempts: attempt
		};
	}
}

/**
 * Test endpoint error handling with invalid parameters
 */
async function testErrorHandling(endpoint: string): Promise<ApiTestResult[]> {
	const errorTests = [
		{
			path: endpoint,
			params: 'invalid=true&metricsDays=999', // Invalid parameter values
			expectedError: 'INVALID_PARAMETER'
		},
		{
			path: endpoint,
			method: 'POST',
			body: '{"invalid": "json"', // Invalid JSON
			expectedError: 'INVALID_JSON'
		},
		{
			path: endpoint,
			method: 'POST',
			body: JSON.stringify({ action: 'unknown_action' }), // Invalid action
			expectedError: 'INVALID_ACTION'
		}
	];

	const results: ApiTestResult[] = [];
	
	for (const test of errorTests) {
		const startTime = Date.now();
		const url = `${TEST_CONFIG.BASE_URL}${test.path}${test.params ? '?' + test.params : ''}`;
		
		try {
			const response = await fetch(url, {
				method: test.method || 'GET',
				headers: { 'Content-Type': 'application/json' },
				body: test.body || undefined,
				signal: AbortSignal.timeout(5000)
			});

			const responseTime = Date.now() - startTime;
			const data = await response.json();
			
			results.push({
				endpoint: test.path,
				method: test.method || 'GET',
				status: response.status >= 400 && response.status < 500 ? 'success' : 'error',
				responseTime,
				statusCode: response.status,
				errorCode: data.code,
				fallbackUsed: false
			});

		} catch (error) {
			results.push({
				endpoint: test.path,
				method: test.method || 'GET',
				status: 'error',
				responseTime: Date.now() - startTime,
				statusCode: 0,
				errorCode: 'TEST_ERROR'
			});
		}
	}

	return results;
}

/**
 * Test API health and performance under load
 */
async function testLoadPerformance(): Promise<ApiTestResult[]> {
	const concurrentRequests = 10;
	const testEndpoint = {
		path: '/api/automation/overview',
		method: 'GET' as const,
		params: new URLSearchParams(),
		expectsData: true,
		critical: true
	};

	console.log(`[API Test] Running load test with ${concurrentRequests} concurrent requests`);
	
	const promises = Array(concurrentRequests).fill(null).map(() => 
		makeApiRequest(testEndpoint)
	);

	const results = await Promise.all(promises);
	
	// Add load test identifier
	results.forEach(result => {
		result.endpoint = result.endpoint + ' (load-test)';
	});

	return results;
}

/**
 * Run comprehensive API reliability test suite
 */
export async function runApiReliabilityTests(): Promise<TestSuiteResults> {
	console.log('🧪 Starting API Reliability Test Suite...');
	console.log(`Testing ${API_ENDPOINTS.length} endpoints`);
	
	const allResults: ApiTestResult[] = [];
	const startTime = Date.now();

	// Test all standard endpoints
	for (const endpoint of API_ENDPOINTS) {
		console.log(`[API Test] Testing ${endpoint.method} ${endpoint.path}`);
		const result = await makeApiRequest(endpoint);
		allResults.push(result);
		
		// Brief pause between requests
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	// Test error handling for critical endpoints
	const criticalEndpoints = API_ENDPOINTS.filter(ep => ep.critical);
	for (const endpoint of criticalEndpoints.slice(0, 2)) { // Test first 2 to avoid overload
		console.log(`[API Test] Testing error handling for ${endpoint.path}`);
		const errorResults = await testErrorHandling(endpoint.path);
		allResults.push(...errorResults);
	}

	// Test load performance
	const loadResults = await testLoadPerformance();
	allResults.push(...loadResults);

	// Calculate metrics
	const totalTime = Date.now() - startTime;
	const passed = allResults.filter(r => r.status === 'success' || r.status === 'fallback').length;
	const failed = allResults.filter(r => r.status === 'error').length;
	const warnings = allResults.filter(r => r.status === 'timeout' || r.responseTime > TEST_CONFIG.SLOW_RESPONSE_THRESHOLD).length;
	
	const averageResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / allResults.length;
	const reliabilityScore = Math.round((passed / allResults.length) * 100);

	const summary = {
		fastResponses: allResults.filter(r => r.responseTime < TEST_CONFIG.FAST_RESPONSE_THRESHOLD).length,
		slowResponses: allResults.filter(r => r.responseTime > TEST_CONFIG.SLOW_RESPONSE_THRESHOLD).length,
		timeouts: allResults.filter(r => r.status === 'timeout').length,
		fallbacksUsed: allResults.filter(r => r.fallbackUsed).length,
		databaseErrors: allResults.filter(r => r.errorCode?.includes('DATABASE')).length
	};

	const results: TestSuiteResults = {
		totalTests: allResults.length,
		passed,
		failed,
		warnings,
		averageResponseTime,
		reliabilityScore,
		results: allResults,
		summary
	};

	// Generate report
	console.log('\n📊 API Reliability Test Results:');
	console.log(`Total Tests: ${results.totalTests}`);
	console.log(`Passed: ${results.passed} (${Math.round(passed/results.totalTests*100)}%)`);
	console.log(`Failed: ${results.failed} (${Math.round(failed/results.totalTests*100)}%)`);
	console.log(`Warnings: ${results.warnings}`);
	console.log(`Average Response Time: ${Math.round(averageResponseTime)}ms`);
	console.log(`Reliability Score: ${reliabilityScore}%`);
	console.log(`Total Test Time: ${Math.round(totalTime/1000)}s`);
	
	console.log('\n📈 Performance Summary:');
	console.log(`Fast Responses (< ${TEST_CONFIG.FAST_RESPONSE_THRESHOLD}ms): ${summary.fastResponses}`);
	console.log(`Slow Responses (> ${TEST_CONFIG.SLOW_RESPONSE_THRESHOLD}ms): ${summary.slowResponses}`);
	console.log(`Timeouts: ${summary.timeouts}`);
	console.log(`Fallbacks Used: ${summary.fallbacksUsed}`);
	console.log(`Database Errors: ${summary.databaseErrors}`);

	// Log detailed results for failed tests
	const failedTests = allResults.filter(r => r.status === 'error' || r.status === 'timeout');
	if (failedTests.length > 0) {
		console.log('\n❌ Failed Tests:');
		failedTests.forEach(test => {
			console.log(`  ${test.method} ${test.endpoint}: ${test.errorCode} (${test.responseTime}ms)`);
		});
	}

	// Log warnings for slow responses
	const slowTests = allResults.filter(r => r.responseTime > TEST_CONFIG.SLOW_RESPONSE_THRESHOLD && r.status === 'success');
	if (slowTests.length > 0) {
		console.log('\n⚠️  Slow Responses:');
		slowTests.forEach(test => {
			console.log(`  ${test.method} ${test.endpoint}: ${test.responseTime}ms`);
		});
	}

	return results;
}

/**
 * Monitor API health continuously
 */
export async function startApiHealthMonitoring(intervalMinutes = 5): Promise<void> {
	console.log(`🔄 Starting continuous API health monitoring (every ${intervalMinutes} minutes)`);
	
	const monitorEndpoints = API_ENDPOINTS.filter(ep => ep.critical);
	
	const runHealthCheck = async () => {
		const results: ApiTestResult[] = [];
		
		for (const endpoint of monitorEndpoints) {
			const result = await makeApiRequest(endpoint);
			results.push(result);
		}
		
		const failed = results.filter(r => r.status === 'error' || r.status === 'timeout');
		const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
		
		if (failed.length > 0) {
			console.warn(`🚨 API Health Alert: ${failed.length}/${results.length} endpoints failing`);
			failed.forEach(test => {
				console.warn(`  ${test.method} ${test.endpoint}: ${test.errorCode || test.status}`);
			});
		} else {
			console.log(`✅ API Health Check: All ${results.length} endpoints healthy (avg: ${Math.round(avgResponseTime)}ms)`);
		}
	};

	// Run initial check
	await runHealthCheck();
	
	// Schedule periodic checks
	setInterval(runHealthCheck, intervalMinutes * 60 * 1000);
}

export default {
	runApiReliabilityTests,
	startApiHealthMonitoring
};