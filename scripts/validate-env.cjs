#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates all required environment variables for production deployment
 */

const fs = require('fs');
const path = require('path');

// Security validation functions
function isWeakSecret(secret) {
  const weakPatterns = [
    'development',
    'test',
    'secret',
    'password',
    '12345',
    'admin',
    'default',
    'example',
    'changeme',
    'placeholder'
  ];
  
  const lowerSecret = secret.toLowerCase();
  return weakPatterns.some(pattern => lowerSecret.includes(pattern));
}

function checkSecretStrength(secret, minLength = 32) {
  if (!secret || secret.length < minLength) {
    return { valid: false, reason: `Must be at least ${minLength} characters` };
  }
  
  if (isWeakSecret(secret)) {
    return { valid: false, reason: 'Contains weak patterns' };
  }
  
  // Check for sufficient entropy (basic check)
  const hasUpperCase = /[A-Z]/.test(secret);
  const hasLowerCase = /[a-z]/.test(secret);
  const hasNumbers = /\d/.test(secret);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(secret);
  
  const criteriaCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  
  if (criteriaCount < 2) {
    return { valid: false, reason: 'Insufficient complexity (need uppercase, lowercase, numbers, or special chars)' };
  }
  
  return { valid: true };
}

// Required environment variables for production
const REQUIRED_ENV_VARS = [
  {
    name: 'NODE_ENV',
    description: 'Application environment',
    validator: (val) => ['development', 'production', 'test'].includes(val),
    example: 'production'
  },
  {
    name: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
    validator: (val) => val.startsWith('postgresql://') && val.length > 20 && !val.includes('localhost'),
    example: 'postgresql://user:pass@host:5432/database',
    prodValidator: (val) => val.includes('sslmode=require') || val.includes('sslmode=prefer')
  },
  {
    name: 'AUTH_SECRET',
    description: 'JWT signing secret (32+ characters)',
    validator: (val) => val.length >= 32 && !isWeakSecret(val),
    example: 'Generate with: npm run generate:secrets',
    sensitive: true
  },
  {
    name: 'NEXTAUTH_SECRET',
    description: 'NextAuth.js secret (should match AUTH_SECRET)',
    validator: (val) => val.length >= 32 && !isWeakSecret(val),
    example: 'Generate with: npm run generate:secrets',
    sensitive: true
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    description: 'Google OAuth client ID',
    validator: (val) => val.length > 20 && val.includes('.googleusercontent.com') && !val.includes('REPLACE_WITH_REAL'),
    example: 'your-google-client-id.googleusercontent.com'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth client secret',
    validator: (val) => val.length > 20 && !val.includes('REPLACE_WITH_REAL'),
    example: 'your-google-client-secret',
    sensitive: true
  },
  {
    name: 'PUBLIC_APP_URL',
    description: 'Public application URL',
    validator: (val) => val.startsWith('http') && val.includes('://') && !val.includes('localhost'),
    example: 'https://your-domain.com',
    prodValidator: (val) => val.startsWith('https://')
  },
  {
    name: 'AUTH_URL',
    description: 'Authentication URL (should match PUBLIC_APP_URL)',
    validator: (val) => val.startsWith('http') && val.includes('://'),
    example: 'https://your-domain.com'
  }
];

// Optional but recommended environment variables
const RECOMMENDED_ENV_VARS = [
  {
    name: 'DB_PASSWORD',
    description: 'Database password (should be strong)',
    validator: (val) => val.length >= 16 && !isWeakSecret(val),
    example: 'Generate with: npm run generate:secrets',
    sensitive: true
  },
  {
    name: 'HIKER_API_KEY',
    description: 'HikerAPI service key',
    validator: (val) => val.length > 10 && !val.includes('REPLACE_WITH_REAL'),
    example: 'your-hiker-api-key',
    sensitive: true
  },
  {
    name: 'DB_POOL_MAX',
    description: 'Database connection pool size',
    validator: (val) => parseInt(val) >= 10 && parseInt(val) <= 50,
    example: '20'
  },
  {
    name: 'PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING',
    description: 'Prisma engine configuration',
    validator: (val) => val === '1',
    example: '1'
  },
  {
    name: 'WS_AUTH_TOKEN',
    description: 'WebSocket authentication token',
    validator: (val) => val.length >= 16 && !isWeakSecret(val),
    example: 'Generate with: npm run generate:secrets',
    sensitive: true
  },
  {
    name: 'INSTANCE_ID',
    description: 'Unique instance identifier',
    validator: (val) => val.length > 10,
    example: 'Generate with: npm run generate:secrets'
  },
  {
    name: 'SENTRY_DSN',
    description: 'Sentry error tracking DSN',
    validator: (val) => val.startsWith('https://') && val.includes('sentry.io'),
    example: 'https://your-dsn@sentry.io/project-id'
  }
];

// Security-specific checks
const SECURITY_CHECKS = [
  {
    name: 'HTTPS_ENFORCEMENT',
    check: () => {
      const appUrl = process.env.PUBLIC_APP_URL;
      const authUrl = process.env.AUTH_URL;
      const nodeEnv = process.env.NODE_ENV;
      
      if (nodeEnv === 'production') {
        if (!appUrl?.startsWith('https://')) {
          return { passed: false, message: 'PUBLIC_APP_URL must use HTTPS in production' };
        }
        if (!authUrl?.startsWith('https://')) {
          return { passed: false, message: 'AUTH_URL must use HTTPS in production' };
        }
      }
      
      return { passed: true, message: 'HTTPS configuration valid' };
    }
  },
  {
    name: 'SECRET_CONSISTENCY',
    check: () => {
      const authSecret = process.env.AUTH_SECRET;
      const nextAuthSecret = process.env.NEXTAUTH_SECRET;
      
      if (authSecret && nextAuthSecret && authSecret !== nextAuthSecret) {
        return { passed: false, message: 'AUTH_SECRET and NEXTAUTH_SECRET should match' };
      }
      
      return { passed: true, message: 'Authentication secrets are consistent' };
    }
  },
  {
    name: 'COOKIE_SECURITY',
    check: () => {
      const nodeEnv = process.env.NODE_ENV;
      const cookieSecure = process.env.COOKIE_SECURE;
      const cookieSameSite = process.env.COOKIE_SAME_SITE;
      
      if (nodeEnv === 'production') {
        if (cookieSecure !== 'true') {
          return { passed: false, message: 'COOKIE_SECURE should be "true" in production' };
        }
        if (cookieSameSite !== 'strict' && cookieSameSite !== 'lax') {
          return { passed: false, message: 'COOKIE_SAME_SITE should be "strict" or "lax" in production' };
        }
      }
      
      return { passed: true, message: 'Cookie security configuration valid' };
    }
  },
  {
    name: 'DATABASE_SSL',
    check: () => {
      const databaseUrl = process.env.DATABASE_URL;
      const nodeEnv = process.env.NODE_ENV;
      
      if (nodeEnv === 'production' && databaseUrl) {
        if (!databaseUrl.includes('sslmode=require') && !databaseUrl.includes('sslmode=prefer')) {
          return { passed: false, message: 'Database connection should use SSL in production (sslmode=require)' };
        }
      }
      
      return { passed: true, message: 'Database SSL configuration valid' };
    }
  }
];

function validateEnvironmentVariables() {
  console.log('🔍 Validating environment variables...\n');
  
  const errors = [];
  const warnings = [];
  const success = [];
  const securityIssues = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value) {
      errors.push(`❌ Missing required: ${envVar.name} - ${envVar.description}`);
    } else if (!envVar.validator(value)) {
      errors.push(`❌ Invalid format: ${envVar.name} - Expected: ${envVar.example}`);
    } else {
      // Additional production-specific checks
      if (process.env.NODE_ENV === 'production' && envVar.prodValidator && !envVar.prodValidator(value)) {
        errors.push(`❌ Production requirement: ${envVar.name} - Must meet production standards`);
      } else {
        const displayValue = envVar.sensitive ? '[REDACTED]' : (value.length > 50 ? value.substring(0, 47) + '...' : value);
        success.push(`✅ ${envVar.name}: ${displayValue}`);
      }
    }
  }

  // Check recommended variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value) {
      warnings.push(`⚠️  Recommended: ${envVar.name} - ${envVar.description} (Example: ${envVar.example})`);
    } else if (!envVar.validator(value)) {
      warnings.push(`⚠️  Invalid format: ${envVar.name} - Expected: ${envVar.example}`);
    } else {
      const displayValue = envVar.sensitive ? '[REDACTED]' : (value.length > 50 ? value.substring(0, 47) + '...' : value);
      success.push(`✅ ${envVar.name}: ${displayValue}`);
    }
  }

  // Run security-specific checks
  console.log('🔒 Running security checks...\n');
  for (const securityCheck of SECURITY_CHECKS) {
    try {
      const result = securityCheck.check();
      if (result.passed) {
        success.push(`✅ ${securityCheck.name}: ${result.message}`);
      } else {
        securityIssues.push(`🚨 ${securityCheck.name}: ${result.message}`);
      }
    } catch (error) {
      warnings.push(`⚠️  Security check failed: ${securityCheck.name} - ${error.message}`);
    }
  }

  // Display results
  if (success.length > 0) {
    console.log('✅ Valid configuration:');
    success.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (securityIssues.length > 0) {
    console.log('🚨 CRITICAL SECURITY ISSUES:');
    securityIssues.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings (recommended for production):');
    warnings.forEach(msg => console.log(`  ${msg}`));
    console.log('');
  }

  if (errors.length > 0 || securityIssues.length > 0) {
    console.log('❌ VALIDATION FAILED');
    if (errors.length > 0) {
      console.log('\n❌ Critical errors (required for deployment):');
      errors.forEach(msg => console.log(`  ${msg}`));
    }
    
    console.log('\n💡 To fix these issues:');
    console.log('  1. Generate new secrets: npm run generate:secrets');
    console.log('  2. Copy environment template: cp .env.production.example .env');
    console.log('  3. Replace all placeholder values with real credentials');
    console.log('  4. Update your database password on the server');
    console.log('  5. Create production Google OAuth credentials');
    console.log('  6. Run this validation script again');
    console.log('');
    process.exit(1);
  }

  console.log('🎉 Environment validation passed!');
  
  if (warnings.length > 0) {
    console.log(`\n📝 Note: ${warnings.length} optional configuration(s) could be set for optimal performance.`);
  }

  // Final production readiness summary
  if (process.env.NODE_ENV === 'production') {
    console.log('\n🚀 PRODUCTION READINESS SUMMARY:');
    console.log('  ✅ All required environment variables configured');
    console.log('  ✅ Security validations passed');
    console.log('  ✅ Production-specific requirements met');
    
    if (warnings.length === 0) {
      console.log('  ✅ All recommended configurations set');
      console.log('\n🟢 READY FOR PRODUCTION DEPLOYMENT');
    } else {
      console.log(`  ⚠️  ${warnings.length} recommended configuration(s) missing`);
      console.log('\n🟡 PRODUCTION READY (with minor optimizations pending)');
    }
  }

  return true;
}

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    console.log('📁 No .env file found, but .env.example exists.');
    console.log('   Run: cp .env.example .env');
    console.log('   Then edit .env with your actual values.\n');
  }
}

function main() {
  console.log('🚀 Production Environment Validation\n');
  
  // Load environment variables from .env file if it exists
  try {
    require('dotenv').config();
  } catch (error) {
    // dotenv not available, continue with process.env
  }

  checkEnvFile();
  validateEnvironmentVariables();
}

if (require.main === module) {
  main();
}

module.exports = { validateEnvironmentVariables };