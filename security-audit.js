#!/usr/bin/env node

/**
 * Security Audit Script for Production Readiness
 * This script performs automated security checks on API endpoints
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security audit results
const auditResults = {
	criticalIssues: [],
	warnings: [],
	recommendations: [],
	passed: [],
	summary: {
		totalEndpoints: 0,
		criticalIssues: 0,
		warnings: 0,
		securityScore: 0
	}
};

// Security patterns to check for
const SECURITY_PATTERNS = {
	// Critical vulnerabilities
	CRITICAL: {
		sqlInjection: /\$\{.*\}|\+.*\$|query.*\+|SELECT.*\+/i,
		xssVulnerable: /innerHTML|outerHTML|insertAdjacentHTML/i,
		hardcodedSecrets: /password.*=.*["'].*["']|secret.*=.*["'].*["']|token.*=.*["'].*["']/i,
		unsafeEval: /eval\(|new Function\(/i,
		directFileAccess: /fs\.readFileSync|fs\.writeFileSync.*req\.|fs\.unlinkSync.*req\./i,
		commandInjection: /exec\(|spawn\(|execSync\(/i
	},

	// Warning level issues
	WARNING: {
		missingRateLimit: /export.*RequestHandler.*async.*=>.*{(?!.*rateLimit).*}/s,
		noAuthCheck: /export.*RequestHandler.*async.*=>.*{(?!.*locals\.user).*}/s,
		logsSensitiveData: /console\.log.*password|console\.log.*token|console\.log.*secret/i,
		missingInputValidation: /await.*request\.json\(\)(?!.*validate|.*schema|.*zod)/i,
		httpInsteadOfHttps: /http:\/\/(?!localhost|127\.0\.0\.1)/i,
		weakCORS: /Access-Control-Allow-Origin.*\*/i
	},

	// Good security practices to check for
	GOOD_PRACTICES: {
		hasRateLimit: /rateLimit/i,
		hasAuthCheck: /locals\.user/i,
		hasInputValidation: /validate|schema|zod/i,
		hasErrorHandling: /try.*catch|handleApiError/s,
		hasSecurityHeaders: /helmet|security.*header/i,
		hasLogging: /logger\.|log.*API/i
	}
};

// Known secure endpoints (health checks, public status, etc.)
const SECURE_ENDPOINTS = [
	'/api/health/',
	'/api/status',
	'/api/errors/report' // Has specific rate limiting
];

function readFileContent(filePath) {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch (error) {
		console.error(`Error reading ${filePath}:`, error.message);
		return '';
	}
}

function checkSecurityPatterns(content, filePath) {
	const issues = {
		critical: [],
		warnings: [],
		good: []
	};

	// Check for critical issues
	for (const [name, pattern] of Object.entries(SECURITY_PATTERNS.CRITICAL)) {
		if (pattern.test(content)) {
			issues.critical.push({
				type: name,
				file: filePath,
				severity: 'CRITICAL',
				description: getCriticalIssueDescription(name)
			});
		}
	}

	// Check for warnings
	for (const [name, pattern] of Object.entries(SECURITY_PATTERNS.WARNING)) {
		if (pattern.test(content)) {
			// Skip if it's a known secure endpoint
			const isSecureEndpoint = SECURE_ENDPOINTS.some(endpoint => 
				filePath.includes(endpoint.replace(/\//g, path.sep))
			);
			
			if (!isSecureEndpoint) {
				issues.warnings.push({
					type: name,
					file: filePath,
					severity: 'WARNING',
					description: getWarningDescription(name)
				});
			}
		}
	}

	// Check for good practices
	for (const [name, pattern] of Object.entries(SECURITY_PATTERNS.GOOD_PRACTICES)) {
		if (pattern.test(content)) {
			issues.good.push({
				type: name,
				file: filePath,
				description: getGoodPracticeDescription(name)
			});
		}
	}

	return issues;
}

function getCriticalIssueDescription(type) {
	const descriptions = {
		sqlInjection: 'Potential SQL injection vulnerability detected',
		xssVulnerable: 'Potential XSS vulnerability through DOM manipulation',
		hardcodedSecrets: 'Hardcoded secrets found in code',
		unsafeEval: 'Unsafe use of eval() or Function constructor',
		directFileAccess: 'Direct file system access with user input',
		commandInjection: 'Potential command injection vulnerability'
	};
	return descriptions[type] || 'Unknown critical issue';
}

function getWarningDescription(type) {
	const descriptions = {
		missingRateLimit: 'Endpoint lacks rate limiting protection',
		noAuthCheck: 'Endpoint lacks authentication verification',
		logsSensitiveData: 'Potentially logging sensitive information',
		missingInputValidation: 'Input validation not detected',
		httpInsteadOfHttps: 'Using HTTP instead of HTTPS',
		weakCORS: 'Overly permissive CORS configuration'
	};
	return descriptions[type] || 'Unknown warning';
}

function getGoodPracticeDescription(type) {
	const descriptions = {
		hasRateLimit: 'Rate limiting implemented',
		hasAuthCheck: 'Authentication check present',
		hasInputValidation: 'Input validation implemented',
		hasErrorHandling: 'Error handling implemented',
		hasSecurityHeaders: 'Security headers configured',
		hasLogging: 'Proper logging implemented'
	};
	return descriptions[type] || 'Good security practice found';
}

function auditEndpoint(filePath) {
	const content = readFileContent(filePath);
	if (!content) return;

	auditResults.summary.totalEndpoints++;

	const issues = checkSecurityPatterns(content, filePath);

	// Add critical issues
	issues.critical.forEach(issue => {
		auditResults.criticalIssues.push(issue);
		auditResults.summary.criticalIssues++;
	});

	// Add warnings
	issues.warnings.forEach(warning => {
		auditResults.warnings.push(warning);
		auditResults.summary.warnings++;
	});

	// Track good practices
	issues.good.forEach(good => {
		auditResults.passed.push(good);
	});
}

function calculateSecurityScore() {
	const totalChecks = auditResults.summary.totalEndpoints * 6; // 6 main security checks per endpoint
	const issues = auditResults.summary.criticalIssues * 3 + auditResults.summary.warnings;
	const goodPractices = auditResults.passed.length;
	
	// Score calculation: start with 100, subtract for issues, add for good practices
	let score = 100 - (issues / totalChecks * 100) + (goodPractices / totalChecks * 20);
	score = Math.max(0, Math.min(100, score)); // Clamp between 0-100
	
	return Math.round(score);
}

function generateReport() {
	auditResults.summary.securityScore = calculateSecurityScore();

	console.log('\n' + '='.repeat(60));
	console.log('🔒 SECURITY AUDIT REPORT - PHASE 5.1');
	console.log('='.repeat(60));
	
	console.log(`\n📊 SUMMARY:`);
	console.log(`   Total Endpoints Scanned: ${auditResults.summary.totalEndpoints}`);
	console.log(`   Critical Issues: ${auditResults.summary.criticalIssues}`);
	console.log(`   Warnings: ${auditResults.summary.warnings}`);
	console.log(`   Security Score: ${auditResults.summary.securityScore}/100`);

	// Security score interpretation
	const scoreColor = auditResults.summary.securityScore >= 90 ? '🟢' : 
					   auditResults.summary.securityScore >= 75 ? '🟡' : '🔴';
	console.log(`   Status: ${scoreColor} ${
		auditResults.summary.securityScore >= 90 ? 'EXCELLENT' :
		auditResults.summary.securityScore >= 75 ? 'GOOD' : 
		auditResults.summary.securityScore >= 60 ? 'NEEDS IMPROVEMENT' : 'CRITICAL'
	}`);

	if (auditResults.criticalIssues.length > 0) {
		console.log(`\n🚨 CRITICAL ISSUES (${auditResults.criticalIssues.length}):`);
		auditResults.criticalIssues.forEach((issue, index) => {
			console.log(`   ${index + 1}. ${issue.description}`);
			console.log(`      File: ${path.relative(__dirname, issue.file)}`);
			console.log(`      Type: ${issue.type}`);
		});
	}

	if (auditResults.warnings.length > 0) {
		console.log(`\n⚠️  WARNINGS (${auditResults.warnings.length}):`);
		auditResults.warnings.slice(0, 10).forEach((warning, index) => {
			console.log(`   ${index + 1}. ${warning.description}`);
			console.log(`      File: ${path.relative(__dirname, warning.file)}`);
		});
		if (auditResults.warnings.length > 10) {
			console.log(`   ... and ${auditResults.warnings.length - 10} more warnings`);
		}
	}

	console.log(`\n✅ SECURITY PRACTICES FOUND (${auditResults.passed.length}):`);
	const practiceStats = {};
	auditResults.passed.forEach(practice => {
		practiceStats[practice.type] = (practiceStats[practice.type] || 0) + 1;
	});
	
	Object.entries(practiceStats).forEach(([practice, count]) => {
		console.log(`   ${getGoodPracticeDescription(practice)}: ${count} endpoints`);
	});

	// Recommendations
	console.log(`\n📋 RECOMMENDATIONS:`);
	
	if (auditResults.summary.criticalIssues > 0) {
		console.log('   🔥 URGENT: Fix all critical security vulnerabilities before deployment');
	}
	
	if (auditResults.summary.warnings > 5) {
		console.log('   ⚡ HIGH: Address security warnings, especially missing auth/rate limiting');
	}
	
	if (auditResults.summary.securityScore < 80) {
		console.log('   📈 IMPROVE: Implement additional security measures to reach 80+ score');
	}

	console.log('   🛡️  Consider penetration testing for comprehensive security validation');
	console.log('   📝 Document security measures and create incident response plan');

	console.log('\n' + '='.repeat(60));
	console.log('Audit completed at:', new Date().toISOString());
	console.log('='.repeat(60) + '\n');

	return {
		passed: auditResults.summary.criticalIssues === 0,
		score: auditResults.summary.securityScore,
		critical: auditResults.summary.criticalIssues,
		warnings: auditResults.summary.warnings
	};
}

function runSecurityAudit() {
	console.log('Starting security audit of API endpoints...\n');

	// Find all API endpoint files
	const apiDir = path.join(__dirname, 'src', 'routes', 'api');
	
	function scanDirectory(dir) {
		const files = fs.readdirSync(dir);
		
		for (const file of files) {
			const fullPath = path.join(dir, file);
			const stat = fs.statSync(fullPath);
			
			if (stat.isDirectory()) {
				scanDirectory(fullPath);
			} else if (file === '+server.ts') {
				console.log(`Scanning: ${path.relative(__dirname, fullPath)}`);
				auditEndpoint(fullPath);
			}
		}
	}

	scanDirectory(apiDir);
	
	return generateReport();
}

// Run the audit
if (process.argv[1] === __filename) {
	const results = runSecurityAudit();
	process.exit(results.passed ? 0 : 1);
}

export { runSecurityAudit, auditResults };