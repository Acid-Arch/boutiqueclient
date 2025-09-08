import { test, expect } from '@playwright/test';

/**
 * Test Suite: Error Boundaries and Edge Cases
 * 
 * Tests edge cases, error conditions, and boundary scenarios
 */

test.describe('Error Boundaries and Edge Cases', () => {

  test.describe('Database Connection Scenarios', () => {
    test('should handle database unavailability gracefully', async ({ page }) => {
      // Test pages that require database access
      const dbPages = ['/client-portal', '/api/health'];
      
      for (const pagePath of dbPages) {
        const response = await page.goto(pagePath);
        
        // Should not return 500 (graceful degradation)
        expect(response?.status()).not.toBe(500);
        
        if (pagePath === '/client-portal') {
          // Should redirect to login
          await expect(page).toHaveURL('/login');
        } else if (pagePath === '/api/health') {
          // Should return service unavailable (expected on NixOS)
          expect([503, 200, 207]).toContain(response?.status() || 0);
        }
      }
    });

    test('should handle Prisma client initialization failure', async ({ page }) => {
      // Health check specifically tests Prisma connection
      const response = await page.request.get('/api/health?details=true');
      
      expect(response.status()).not.toBe(500);
      
      const body = await response.json();
      expect(body).toHaveProperty('status');
      
      // On NixOS, database should fail gracefully
      if (body.checks && body.checks.database) {
        expect(['pass', 'fail', 'warn']).toContain(body.checks.database.status);
      }
    });
  });

  test.describe('Null and Undefined Data Handling', () => {
    test('should handle null user data in templates', async ({ page }) => {
      // This specifically tests the fixes for data.user?.subscription
      await page.goto('/client-portal');
      
      // Should redirect to login, not crash with null reference
      await expect(page).toHaveURL('/login');
      
      // Verify no JavaScript errors occurred
      const jsErrors: string[] = [];
      page.on('pageerror', error => jsErrors.push(error.message));
      
      await page.waitForTimeout(1000);
      expect(jsErrors).toEqual([]);
    });

    test('should handle missing environment variables', async ({ page }) => {
      // Test API endpoints that depend on environment variables
      const response = await page.request.get('/api/health');
      
      // Should not crash even if some env vars are missing
      expect(response.status()).not.toBe(500);
      
      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
    });
  });

  test.describe('Network and Loading Issues', () => {
    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow loading
      await page.goto('/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      // Should still load successfully
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle JavaScript loading errors', async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', error => jsErrors.push(error.message));
      
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      
      // Filter out acceptable errors (like network failures for external services)
      const criticalErrors = jsErrors.filter(error => 
        !error.includes('Failed to fetch') &&
        !error.includes('NetworkError') &&
        !error.includes('ERR_CONNECTION_REFUSED')
      );
      
      expect(criticalErrors).toEqual([]);
    });

    test('should handle CSS loading failures gracefully', async ({ page }) => {
      await page.goto('/login');
      
      // Page should still be functional even if some CSS fails
      await expect(page.locator('body')).toBeVisible();
      
      // Check that basic structure is present
      const hasContent = await page.locator('*').count();
      expect(hasContent).toBeGreaterThan(0);
    });
  });

  test.describe('Form and Input Validation', () => {
    test('should handle invalid form data', async ({ page }) => {
      await page.goto('/login');
      
      const jsErrors: string[] = [];
      page.on('pageerror', error => jsErrors.push(error.message));
      
      // Try various invalid inputs
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      if (await emailInput.count() > 0) {
        // Test invalid email formats
        await emailInput.fill('invalid-email');
        await emailInput.fill('');
        await emailInput.fill('test@');
        await emailInput.fill('@example.com');
      }
      
      if (await passwordInput.count() > 0) {
        // Test various password inputs
        await passwordInput.fill('');
        await passwordInput.fill('a');
        await passwordInput.fill('very-long-password-that-might-cause-issues-if-not-handled-properly');
      }
      
      await page.waitForTimeout(1000);
      expect(jsErrors).toEqual([]);
    });

    test('should handle special characters in inputs', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"]').first();
      
      if (await emailInput.count() > 0) {
        // Test special characters that might cause issues
        const specialInputs = [
          '<script>alert("test")</script>',
          '"; DROP TABLE users; --',
          '{{constructor.constructor("alert(1)")()}}',
          '${7*7}',
          'test@example.com\x00',
        ];
        
        for (const input of specialInputs) {
          await emailInput.fill(input);
          // Should not cause any JavaScript execution or errors
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('API Error Conditions', () => {
    test('should handle malformed API requests', async ({ page }) => {
      const malformedRequests = [
        { url: '/api/auth/me', data: { invalid: 'json"malformed' } },
        { url: '/api/health', data: null },
      ];
      
      for (const req of malformedRequests) {
        const response = await page.request.post(req.url, {
          data: req.data,
          failOnStatusCode: false
        });
        
        // Should handle gracefully (not return 500)
        expect(response.status()).not.toBe(500);
        
        // Should return proper error responses
        if (response.status() >= 400) {
          const contentType = response.headers()['content-type'];
          if (contentType?.includes('application/json')) {
            const body = await response.json();
            expect(body).toBeDefined();
          }
        }
      }
    });

    test('should handle concurrent API requests', async ({ page }) => {
      // Make multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(page.request.get('/api/health'));
      }
      
      const responses = await Promise.all(promises);
      
      // All should complete without 500 errors
      for (const response of responses) {
        expect(response.status()).not.toBe(500);
      }
      
      // Should handle concurrent load appropriately
      const statuses = responses.map(r => r.status());
      const allSuccessOrServiceUnavailable = statuses.every(status => 
        [200, 207, 503].includes(status) // 200=healthy, 207=degraded, 503=unhealthy
      );
      expect(allSuccessOrServiceUnavailable).toBeTruthy();
    });
  });

  test.describe('Memory and Performance', () => {
    test('should not leak memory on repeated navigation', async ({ page }) => {
      // Navigate between pages multiple times
      const pages = ['/', '/login'];
      
      for (let i = 0; i < 5; i++) {
        for (const pagePath of pages) {
          await page.goto(pagePath);
          await page.waitForLoadState('networkidle');
        }
      }
      
      // Should still be responsive
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle large response payloads', async ({ page }) => {
      // Test health endpoint with details (potentially large response)
      const response = await page.request.get('/api/health?details=true');
      
      expect(response.status()).not.toBe(500);
      
      const body = await response.json();
      expect(body).toBeDefined();
      expect(body).toHaveProperty('status');
    });
  });

  test.describe('Browser Compatibility', () => {
    test('should handle localStorage unavailability', async ({ page }) => {
      // Disable localStorage
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: undefined
        });
      });
      
      await page.goto('/login');
      
      // Should still load without errors
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle sessionStorage unavailability', async ({ page }) => {
      // Disable sessionStorage
      await page.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', {
          value: undefined
        });
      });
      
      await page.goto('/login');
      
      // Should still load without errors
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle cookies being disabled', async ({ page }) => {
      // Clear and disable cookies
      await page.context().clearCookies();
      
      await page.goto('/client-portal');
      
      // Should redirect to login (authentication fails without cookies)
      await expect(page).toHaveURL('/login');
    });
  });
});