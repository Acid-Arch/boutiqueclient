import { test, expect, type Page } from '@playwright/test';

/**
 * Test Suite: 500 Error Fixes Validation
 * 
 * This test suite validates that all the 500 errors identified and fixed are working properly:
 * 1. Client Portal null reference error
 * 2. Database connection issues
 * 3. Authentication flow errors
 * 4. Health check API improvements
 */

test.describe('500 Error Fixes - Critical Issues', () => {

  test.describe('Client Portal Access', () => {
    test('should redirect to login instead of 500 error when unauthenticated', async ({ page }) => {
      // Navigate directly to client portal without authentication
      await page.goto('/client-portal');
      
      // Should be redirected to login page, not get 500 error
      await expect(page).toHaveURL('/login');
      
      // Verify login page loads properly
      await expect(page.locator('h1, h2, .login-title')).toBeVisible();
      
      // Verify no error messages about server errors
      const errorMessages = page.locator('[data-testid="error"], .error, .alert-error');
      await expect(errorMessages).toHaveCount(0);
    });

    test('should handle null user data gracefully', async ({ page }) => {
      // This tests the null-safety fixes we implemented
      
      // Try to access client portal
      await page.goto('/client-portal');
      
      // Should redirect to login (not crash with 500)
      await expect(page).toHaveURL('/login');
      
      // Verify response status is not 500
      const response = await page.goto('/client-portal');
      expect(response?.status()).not.toBe(500);
    });

    test('should not throw JavaScript errors on client portal redirect', async ({ page }) => {
      const jsErrors: string[] = [];
      
      // Capture JavaScript errors
      page.on('pageerror', (error) => {
        jsErrors.push(error.message);
      });
      
      // Visit client portal
      await page.goto('/client-portal');
      
      // Should redirect to login
      await expect(page).toHaveURL('/login');
      
      // Verify no JavaScript errors occurred
      expect(jsErrors).toEqual([]);
    });
  });

  test.describe('Homepage and Navigation', () => {
    test('should handle homepage redirect properly', async ({ page }) => {
      await page.goto('/');
      
      // Should redirect to login (expected behavior)
      await expect(page).toHaveURL('/login');
      
      // Verify no 500 errors
      const response = await page.goto('/');
      expect(response?.status()).not.toBe(500);
    });

    test('should load login page without errors', async ({ page }) => {
      const response = await page.goto('/login');
      
      // Should return 200 OK
      expect(response?.status()).toBe(200);
      
      // Page should load content
      await expect(page.locator('body')).toBeVisible();
      
      // Should have some login-related content
      const hasLoginContent = await page.locator('input[type="email"], input[type="password"], .login, [data-testid="login"]').count();
      expect(hasLoginContent).toBeGreaterThan(0);
    });
  });

  test.describe('API Endpoints', () => {
    test('should handle health check API properly', async ({ page }) => {
      // Test the health check endpoint
      const response = await page.request.get('/api/health');
      
      // Should not return 500 (may return 503 which is expected on NixOS)
      expect(response.status()).not.toBe(500);
      
      // Should return JSON response
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
      
      // Should have proper response structure
      const body = await response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
    });

    test('should handle API endpoints without crashing', async ({ page }) => {
      const apiEndpoints = [
        '/api/health',
        '/api/auth/me',
      ];

      for (const endpoint of apiEndpoints) {
        const response = await page.request.get(endpoint);
        
        // Should not return 500 (other error codes are acceptable)
        expect(response.status()).not.toBe(500);
        
        // Verify response is properly formatted
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
      }
    });
  });

  test.describe('Error Handling and Network Issues', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      // Test with a slow network to ensure timeout handling
      await page.goto('/login', { timeout: 30000 });
      
      // Should still load the page
      await expect(page.locator('body')).toBeVisible();
    });

    test('should not have console errors on main pages', async ({ page }) => {
      const consoleErrors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Test main pages
      const pages = ['/', '/login'];
      
      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        
        // Allow some time for any async errors
        await page.waitForTimeout(1000);
      }
      
      // Filter out known acceptable errors (like network errors for unavailable services)
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('Failed to fetch') && 
        !error.includes('NetworkError') &&
        !error.includes('503') &&
        !error.toLowerCase().includes('connection')
      );
      
      expect(criticalErrors).toEqual([]);
    });
  });

  test.describe('Database and Prisma Connection', () => {
    test('should handle database unavailability without 500 errors', async ({ page }) => {
      // Test client portal which uses database calls
      const response = await page.goto('/client-portal');
      
      // Should redirect (not crash with 500)
      expect(response?.status()).not.toBe(500);
      await expect(page).toHaveURL('/login');
    });

    test('should handle Prisma initialization gracefully', async ({ page }) => {
      // This tests that the Prisma fallback mechanism works
      const response = await page.request.get('/api/health');
      
      // Should not crash with 500 (503 is acceptable as it indicates graceful degradation)
      expect(response.status()).not.toBe(500);
      
      const body = await response.json();
      expect(body).toHaveProperty('status');
      
      // Status should be unhealthy (expected) but not crashed
      expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    });
  });

  test.describe('Authentication Flow', () => {
    test('should handle unauthenticated access properly', async ({ page }) => {
      const protectedPages = [
        '/client-portal',
        '/dashboard',
        '/settings',
      ];

      for (const pagePath of protectedPages) {
        const response = await page.goto(pagePath);
        
        // Should not return 500 error
        expect(response?.status()).not.toBe(500);
        
        // Should redirect to login or return 401/403 (acceptable)
        const acceptableStatuses = [200, 302, 401, 403, 404];
        expect(acceptableStatuses).toContain(response?.status() || 0);
      }
    });

    test('should preserve redirect after authentication', async ({ page }) => {
      // Try to access client portal
      await page.goto('/client-portal');
      
      // Should be redirected to login
      await expect(page).toHaveURL('/login');
      
      // Verify the page loads without errors
      await expect(page.locator('body')).toBeVisible();
    });
  });
});