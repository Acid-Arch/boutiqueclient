// Visual Testing Script using Playwright
// This script captures screenshots to visually verify the fixes

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function runVisualTests() {
  console.log('🎬 Starting Visual Testing with Playwright...');
  console.log('📸 This will capture screenshots to verify our fixes\n');

  let browser;
  let successCount = 0;
  let errorCount = 0;

  try {
    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });
    
    const page = await context.newPage();
    
    // Create screenshots directory
    const screenshotDir = 'test-screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }

    console.log('✅ Browser launched successfully\n');

    // Test cases with visual verification
    const testCases = [
      {
        name: 'Homepage Access',
        description: 'Should redirect to login (not show 500 error)',
        url: 'http://localhost:5173/',
        expectedBehavior: 'Redirect to /login'
      },
      {
        name: 'Login Page',
        description: 'Should load login page without errors',
        url: 'http://localhost:5173/login',
        expectedBehavior: 'Display login form'
      },
      {
        name: 'Client Portal (Unauthenticated)',
        description: 'Should redirect to login (not show 500 error)',
        url: 'http://localhost:5173/client-portal',
        expectedBehavior: 'Redirect to /login'
      },
      {
        name: 'Direct Client Portal Access',
        description: 'Test the specific 500 error fix',
        url: 'http://localhost:5173/client-portal',
        expectedBehavior: 'Should not crash with null reference'
      }
    ];

    // Run visual tests
    for (let i = 0; i < testCases.length; i++) {
      const test = testCases[i];
      const testNumber = i + 1;
      
      console.log(`\n📋 Test ${testNumber}/${testCases.length}: ${test.name}`);
      console.log(`   Description: ${test.description}`);
      console.log(`   URL: ${test.url}`);
      console.log(`   Expected: ${test.expectedBehavior}`);

      try {
        // Navigate to URL and capture any errors
        let response;
        let navigationError = null;
        let jsErrors = [];
        
        // Capture JavaScript errors
        page.on('pageerror', (error) => {
          jsErrors.push(error.message);
        });

        // Navigate to page
        try {
          response = await page.goto(test.url, { 
            waitUntil: 'networkidle', 
            timeout: 15000 
          });
        } catch (error) {
          navigationError = error.message;
        }

        // Get current URL after potential redirects
        const finalUrl = page.url();
        const httpStatus = response ? response.status() : 'unknown';

        // Take screenshot
        const screenshotPath = path.join(screenshotDir, `test-${testNumber}-${test.name.toLowerCase().replace(/\s+/g, '-')}.png`);
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });

        // Analyze results
        console.log(`   📊 Results:`);
        console.log(`      HTTP Status: ${httpStatus}`);
        console.log(`      Final URL: ${finalUrl}`);
        console.log(`      Screenshot: ${screenshotPath}`);

        if (navigationError) {
          console.log(`      ⚠️  Navigation Error: ${navigationError}`);
          errorCount++;
        } else if (httpStatus >= 500) {
          console.log(`      ❌ CRITICAL: 500-level error detected!`);
          errorCount++;
        } else if (httpStatus >= 400) {
          console.log(`      ⚠️  Client error (${httpStatus}) - this may be expected`);
        } else {
          console.log(`      ✅ No 500 errors detected`);
          successCount++;
        }

        if (jsErrors.length > 0) {
          console.log(`      🐛 JavaScript Errors:`);
          jsErrors.forEach(error => {
            console.log(`         - ${error}`);
          });
          errorCount++;
        } else {
          console.log(`      ✅ No JavaScript errors`);
        }

        // Check for specific error indicators in page content
        const pageContent = await page.textContent('body').catch(() => '');
        const hasInternalError = pageContent.includes('Internal Server Error') || 
                               pageContent.includes('500') ||
                               pageContent.includes('TypeError') ||
                               pageContent.includes('Cannot read properties of null');

        if (hasInternalError) {
          console.log(`      ❌ CRITICAL: Error content detected in page!`);
          errorCount++;
        } else {
          console.log(`      ✅ No error content detected in page`);
        }

        // Wait a bit for any async errors
        await page.waitForTimeout(1000);

      } catch (error) {
        console.log(`   ❌ Test failed with error: ${error.message}`);
        errorCount++;
        
        // Still try to take a screenshot of the error state
        try {
          const errorScreenshotPath = path.join(screenshotDir, `test-${testNumber}-ERROR.png`);
          await page.screenshot({ path: errorScreenshotPath, fullPage: true });
          console.log(`      Error screenshot: ${errorScreenshotPath}`);
        } catch (screenshotError) {
          console.log(`      Could not capture error screenshot: ${screenshotError.message}`);
        }
      }
    }

    // Additional API tests (no screenshots needed)
    console.log(`\n\n🔌 API ENDPOINT TESTS\n`);
    
    const apiTests = [
      { name: 'Health Check', url: 'http://localhost:5173/api/health' },
      { name: 'Auth Me', url: 'http://localhost:5173/api/auth/me' }
    ];

    for (const apiTest of apiTests) {
      console.log(`📡 Testing API: ${apiTest.name}`);
      console.log(`   URL: ${apiTest.url}`);
      
      try {
        const response = await page.goto(apiTest.url, { timeout: 10000 });
        const status = response.status();
        const contentType = response.headers()['content-type'] || 'unknown';
        
        console.log(`   Status: ${status}`);
        console.log(`   Content-Type: ${contentType}`);
        
        if (status >= 500) {
          console.log(`   ❌ CRITICAL: 500-level error!`);
          errorCount++;
        } else {
          console.log(`   ✅ No 500 error detected`);
          successCount++;
        }

        // Try to parse JSON response
        if (contentType.includes('application/json')) {
          try {
            const jsonContent = await response.json();
            console.log(`   📋 JSON Response Keys: ${Object.keys(jsonContent).join(', ')}`);
          } catch (e) {
            console.log(`   ⚠️  Could not parse JSON response`);
          }
        }
      } catch (error) {
        console.log(`   ❌ API test failed: ${error.message}`);
        errorCount++;
      }
      console.log('');
    }

  } catch (error) {
    console.error('💥 Fatal error during testing:', error.message);
    errorCount++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Final results
  console.log('\n========================================');
  console.log('📊 VISUAL TESTING RESULTS');
  console.log('========================================');
  console.log(`✅ Successful tests: ${successCount}`);
  console.log(`❌ Failed/Error tests: ${errorCount}`);
  console.log(`📁 Screenshots saved to: ./test-screenshots/`);

  if (errorCount === 0) {
    console.log('\n🎉 ALL VISUAL TESTS PASSED!');
    console.log('✅ No 500 errors detected');
    console.log('✅ All fixes are working visually');
  } else {
    console.log('\n⚠️  SOME ISSUES DETECTED');
    console.log('📸 Check screenshots for visual verification');
    console.log('🔍 Review error messages above');
  }

  console.log('\n========================================');
  return errorCount === 0;
}

// Run the tests
runVisualTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });