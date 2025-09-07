#!/usr/bin/env node

/**
 * Authentication Flow Testing Script
 * Tests all authentication flows end-to-end
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5173';
const TEST_RESULTS = [];

// Test configuration
const TEST_CREDENTIALS = {
	valid: {
		email: 'test@example.com',
		password: 'TestPassword123!'
	},
	invalid: {
		email: 'invalid@example.com',
		password: 'wrongpassword'
	}
};

function logTest(name, passed, details = '') {
	const status = passed ? '✅ PASS' : '❌ FAIL';
	console.log(`${status} ${name}`);
	if (details) console.log(`   ${details}`);
	
	TEST_RESULTS.push({ name, passed, details });
}

async function testHealthEndpoint() {
	console.log('\n🏥 Testing Health Endpoints...');
	
	try {
		// Test basic health
		const healthResponse = await fetch(`${BASE_URL}/api/health/simple`);
		const healthData = await healthResponse.json();
		
		logTest('Health endpoint responds', 
			healthResponse.ok && healthData.status === 'ok',
			`Status: ${healthResponse.status}, Response: ${JSON.stringify(healthData)}`);
			
		// Test detailed health
		const detailedHealth = await fetch(`${BASE_URL}/api/health?details=true`);
		const detailedData = await detailedHealth.json();
		
		logTest('Detailed health check works',
			detailedHealth.ok && detailedData.checks,
			`Database status: ${detailedData.checks?.database?.status}`);
			
	} catch (error) {
		logTest('Health endpoints', false, `Error: ${error.message}`);
	}
}

async function testUnauthorizedAccess() {
	console.log('\n🔒 Testing Unauthorized Access...');
	
	const protectedEndpoints = [
		'/api/accounts',
		'/api/devices',
		'/api/dashboard',
		'/api/metrics',
		'/api/alerts'
	];
	
	for (const endpoint of protectedEndpoints) {
		try {
			const response = await fetch(`${BASE_URL}${endpoint}`);
			
			// Should be redirected to login or return 401/403
			const isProtected = response.status === 302 || 
							   response.status === 401 || 
							   response.status === 403;
			
			logTest(`${endpoint} properly protected`, 
				isProtected,
				`Status: ${response.status}`);
				
		} catch (error) {
			logTest(`${endpoint} protection`, false, `Error: ${error.message}`);
		}
	}
}

async function testRateLimiting() {
	console.log('\n⏱️ Testing Rate Limiting...');
	
	try {
		// Test rate limiting on login endpoint
		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(
				fetch(`${BASE_URL}/api/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(TEST_CREDENTIALS.invalid)
				})
			);
		}
		
		const responses = await Promise.all(promises);
		const rateLimited = responses.some(r => r.status === 429);
		
		logTest('Rate limiting active on login',
			rateLimited,
			`Got ${responses.filter(r => r.status === 429).length} rate-limited responses`);
			
	} catch (error) {
		logTest('Rate limiting test', false, `Error: ${error.message}`);
	}
}

async function testInputValidation() {
	console.log('\n🛡️ Testing Input Validation...');
	
	const maliciousPayloads = [
		// XSS attempts
		{ email: '<script>alert("xss")</script>', password: 'test' },
		// SQL injection attempts  
		{ email: "' OR 1=1--", password: 'test' },
		// Oversized input
		{ email: 'a'.repeat(1000) + '@test.com', password: 'test' }
	];
	
	for (const [index, payload] of maliciousPayloads.entries()) {
		try {
			const response = await fetch(`${BASE_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			
			// Should be rejected with 400 (validation error) or 401 (invalid creds)
			const isValidated = response.status === 400 || response.status === 401;
			
			logTest(`Malicious payload ${index + 1} rejected`,
				isValidated,
				`Payload type: ${index === 0 ? 'XSS' : index === 1 ? 'SQL Injection' : 'Oversized'}, Status: ${response.status}`);
				
		} catch (error) {
			logTest(`Input validation test ${index + 1}`, false, `Error: ${error.message}`);
		}
	}
}

async function testSecurityHeaders() {
	console.log('\n📋 Testing Security Headers...');
	
	try {
		const response = await fetch(`${BASE_URL}/api/health/simple`);
		const headers = response.headers;
		
		const securityHeaders = {
			'Content-Security-Policy': headers.get('content-security-policy'),
			'X-Frame-Options': headers.get('x-frame-options'),
			'X-Content-Type-Options': headers.get('x-content-type-options'),
			'Referrer-Policy': headers.get('referrer-policy')
		};
		
		for (const [headerName, headerValue] of Object.entries(securityHeaders)) {
			logTest(`${headerName} header present`,
				!!headerValue,
				headerValue ? `Value: ${headerValue.substring(0, 50)}...` : 'Header missing');
		}
		
	} catch (error) {
		logTest('Security headers test', false, `Error: ${error.message}`);
	}
}

async function testErrorHandling() {
	console.log('\n🚨 Testing Error Handling...');
	
	const errorTests = [
		{ endpoint: '/api/nonexistent', expectedStatus: 404 },
		{ endpoint: '/api/accounts/invalid-id', expectedStatus: [400, 404] }
	];
	
	for (const test of errorTests) {
		try {
			const response = await fetch(`${BASE_URL}${test.endpoint}`);
			
			const expectedStatuses = Array.isArray(test.expectedStatus) ? 
				test.expectedStatus : [test.expectedStatus];
			const statusMatches = expectedStatuses.includes(response.status);
			
			logTest(`Error handling for ${test.endpoint}`,
				statusMatches,
				`Expected: ${test.expectedStatus}, Got: ${response.status}`);
				
		} catch (error) {
			logTest(`Error handling test for ${test.endpoint}`, false, `Error: ${error.message}`);
		}
	}
}

async function testStatusPage() {
	console.log('\n📊 Testing Status Page...');
	
	try {
		const response = await fetch(`${BASE_URL}/status`);
		
		logTest('Status page accessible',
			response.ok,
			`Status: ${response.status}`);
			
		if (response.ok) {
			const content = await response.text();
			const hasContent = content.includes('System Status') || 
							   content.includes('health') || 
							   content.includes('operational');
			
			logTest('Status page has meaningful content',
				hasContent,
				hasContent ? 'Contains status information' : 'Missing expected content');
		}
		
	} catch (error) {
		logTest('Status page test', false, `Error: ${error.message}`);
	}
}

function generateReport() {
	const passed = TEST_RESULTS.filter(t => t.passed).length;
	const total = TEST_RESULTS.length;
	const percentage = Math.round((passed / total) * 100);
	
	console.log('\n' + '='.repeat(60));
	console.log('🧪 AUTHENTICATION & SECURITY TESTING REPORT');
	console.log('='.repeat(60));
	console.log(`\n📊 RESULTS SUMMARY:`);
	console.log(`   Tests Passed: ${passed}/${total} (${percentage}%)`);
	console.log(`   Tests Failed: ${total - passed}`);
	
	const status = percentage >= 95 ? '🟢 EXCELLENT' :
				   percentage >= 85 ? '🟡 GOOD' :
				   percentage >= 70 ? '🟠 NEEDS IMPROVEMENT' : '🔴 CRITICAL';
	console.log(`   Overall Status: ${status}`);
	
	if (total - passed > 0) {
		console.log(`\n❌ FAILED TESTS:`);
		TEST_RESULTS.filter(t => !t.passed).forEach((test, index) => {
			console.log(`   ${index + 1}. ${test.name}`);
			if (test.details) console.log(`      ${test.details}`);
		});
	}
	
	console.log(`\n📋 RECOMMENDATIONS:`);
	if (percentage >= 95) {
		console.log('   ✨ Excellent security posture - ready for production!');
	} else if (percentage >= 85) {
		console.log('   👍 Good security - address failed tests before production');
	} else {
		console.log('   ⚠️  Security issues need immediate attention');
	}
	
	console.log('\n' + '='.repeat(60));
	console.log('Test completed at:', new Date().toISOString());
	console.log('='.repeat(60) + '\n');
	
	return { passed, total, percentage };
}

async function runAuthFlowTests() {
	console.log('🚀 Starting Authentication Flow Tests...\n');
	console.log('NOTE: This test requires the development server to be running on localhost:5173\n');
	
	// Run all tests
	await testHealthEndpoint();
	await testUnauthorizedAccess();
	await testRateLimiting();
	await testInputValidation();
	await testSecurityHeaders();
	await testErrorHandling();
	await testStatusPage();
	
	// Generate final report
	const results = generateReport();
	
	return results.percentage >= 85;
}

// Run tests if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
	runAuthFlowTests()
		.then(success => process.exit(success ? 0 : 1))
		.catch(error => {
			console.error('Test runner failed:', error);
			process.exit(1);
		});
}

export { runAuthFlowTests };