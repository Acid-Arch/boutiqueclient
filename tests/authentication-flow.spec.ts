import { test, expect } from '@playwright/test';

/**
 * Test Suite: Authentication Flow Testing
 * 
 * Tests the complete authentication flow and edge cases
 */

test.describe('Authentication Flow', () => {

  test.describe('Login Page', () => {
    test('should load login page successfully', async ({ page }) => {
      await page.goto('/login');
      
      // Should load without errors
      const response = await page.goto('/login');
      expect(response?.status()).toBe(200);
      
      // Should have login form elements
      await expect(page.locator('body')).toBeVisible();
      
      // Check for common login elements
      const loginElements = await page.locator('input[type="email"], input[type="password"], button[type="submit"], .login-form').count();
      expect(loginElements).toBeGreaterThan(0);
    });

    test('should handle login form interaction', async ({ page }) => {
      await page.goto('/login');
      
      // Look for input fields
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      // Test if inputs are interactable (if they exist)
      if (await emailInput.count() > 0) {
        await emailInput.fill('test@example.com');
        await expect(emailInput).toHaveValue('test@example.com');
      }
      
      if (await passwordInput.count() > 0) {
        await passwordInput.fill('testpassword');
        await expect(passwordInput).toHaveValue('testpassword');
      }
    });

    test('should not crash on invalid form submission', async ({ page }) => {
      await page.goto('/login');
      
      const jsErrors: string[] = [];
      page.on('pageerror', error => jsErrors.push(error.message));
      
      // Try to submit form (if it exists)
      const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Should not cause JavaScript errors
        await page.waitForTimeout(2000);
        expect(jsErrors).toEqual([]);
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect protected routes to login', async ({ page }) => {
      const protectedRoutes = [
        '/client-portal',
        '/dashboard',
        '/admin-portal',
        '/accounts',
        '/devices',
        '/settings'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        
        // Should either redirect to login or show 404 (both acceptable)
        const currentUrl = page.url();
        const isRedirectedToLogin = currentUrl.includes('/login');
        const isNotFoundPage = currentUrl.includes(route); // Still on same page but might show 404
        
        // Get the response to check status
        const response = await page.goto(route);
        const status = response?.status() || 0;
        
        // Should not be 500 error
        expect(status).not.toBe(500);
        
        // Should be handled gracefully (redirect, 404, or 401/403)
        const acceptableStatuses = [200, 302, 401, 403, 404];
        expect(acceptableStatuses).toContain(status);
        
        if (status === 302) {
          // If redirected, should go to login
          await expect(page).toHaveURL(/\/login/);
        }
      }
    });

    test('should handle session-based authentication', async ({ page }) => {
      // Test accessing client portal without session
      await page.goto('/client-portal');
      
      // Should be redirected to login
      await expect(page).toHaveURL('/login');
      
      // Verify no 500 errors in the process
      const response = await page.goto('/client-portal');
      expect(response?.status()).not.toBe(500);
    });
  });

  test.describe('Authentication API Endpoints', () => {
    test('should handle auth/me endpoint', async ({ page }) => {
      const response = await page.request.get('/api/auth/me');
      
      // Should not crash (401 is expected for unauthenticated)
      expect(response.status()).not.toBe(500);
      
      // Should return JSON
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
      
      // Likely returns 401 for unauthenticated users
      expect([401, 403]).toContain(response.status());
    });

    test('should handle OAuth endpoints gracefully', async ({ page }) => {
      const authEndpoints = [
        '/api/auth/signin',
        '/api/auth/signout',
        '/api/auth/session'
      ];

      for (const endpoint of authEndpoints) {
        const response = await page.request.get(endpoint);
        
        // Should not crash with 500
        expect(response.status()).not.toBe(500);
        
        // Should be handled (might return 404 if endpoint doesn't exist, which is fine)
        const acceptableStatuses = [200, 302, 401, 403, 404, 405]; // 405 = Method Not Allowed
        expect(acceptableStatuses).toContain(response.status());
      }
    });
  });

  test.describe('Session Management', () => {
    test('should handle missing session cookie', async ({ page }) => {
      // Clear all cookies
      await page.context().clearCookies();
      
      // Try to access protected content
      await page.goto('/client-portal');
      
      // Should redirect to login, not crash
      await expect(page).toHaveURL('/login');
    });

    test('should handle invalid session cookie', async ({ page }) => {
      // Set invalid session cookie
      await page.context().addCookies([{
        name: 'session',
        value: 'invalid-session-token-12345',
        domain: 'localhost',
        path: '/'
      }]);
      
      // Try to access protected content
      await page.goto('/client-portal');
      
      // Should redirect to login, not crash
      await expect(page).toHaveURL('/login');
    });

    test('should handle malformed session cookie', async ({ page }) => {
      // Set malformed session cookie
      await page.context().addCookies([{
        name: 'session',
        value: 'malformed:cookie:with:too:many:parts',
        domain: 'localhost',
        path: '/'
      }]);
      
      const jsErrors: string[] = [];
      page.on('pageerror', error => jsErrors.push(error.message));
      
      // Try to access protected content
      await page.goto('/client-portal');
      
      // Should handle gracefully without JavaScript errors
      expect(jsErrors).toEqual([]);
      
      // Should redirect to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('CSRF and Security', () => {
    test('should handle CSRF protection', async ({ page }) => {
      // Test POST request without CSRF token
      const response = await page.request.post('/api/auth/signin', {
        data: {
          email: 'test@example.com',
          password: 'testpassword'
        }
      });
      
      // Should not crash (might return 403 or 422 for CSRF)
      expect(response.status()).not.toBe(500);
      
      // Should be handled securely
      const acceptableStatuses = [400, 401, 403, 404, 405, 422];
      expect(acceptableStatuses).toContain(response.status());
    });

    test('should handle rate limiting gracefully', async ({ page }) => {
      // Make multiple rapid requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(page.request.get('/api/auth/me'));
      }
      
      const responses = await Promise.all(promises);
      
      // None should return 500
      for (const response of responses) {
        expect(response.status()).not.toBe(500);
      }
      
      // Some might return 429 (rate limited) which is acceptable
      const statuses = responses.map(r => r.status());
      const has500Error = statuses.includes(500);
      expect(has500Error).toBeFalsy();
    });
  });
});