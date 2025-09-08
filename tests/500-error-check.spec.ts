import { test, expect } from '@playwright/test';

test.describe('500 Error Detection Tests', () => {
  
  test('Homepage should not return 500 error', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).not.toBe(500);
    expect(response?.status()).toBeLessThan(500);
  });

  test('Login page should not return 500 error', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).not.toBe(500);
    expect(response?.status()).toBeLessThan(500);
  });

  test('Client portal should not return 500 error', async ({ page }) => {
    const response = await page.goto('/client-portal');
    expect(response?.status()).not.toBe(500);
    // May return 401/403 if not authenticated, which is expected
    expect(response?.status()).toBeLessThan(500);
  });

  test('API health check should not return 500 error', async ({ page }) => {
    const response = await page.goto('/api/health');
    expect(response?.status()).not.toBe(500);
    expect(response?.status()).toBeLessThan(500);
  });

  test('API auth endpoints should not return 500 error', async ({ page }) => {
    // Test auth/me endpoint
    const authMeResponse = await page.goto('/api/auth/me');
    expect(authMeResponse?.status()).not.toBe(500);
    expect(authMeResponse?.status()).toBeLessThan(500);
  });

  test('Static assets should load without 500 errors', async ({ page }) => {
    // Navigate to homepage first
    await page.goto('/');
    
    // Check for any 500 errors in network requests
    const failedRequests: any[] = [];
    
    page.on('response', response => {
      if (response.status() >= 500) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    // Report any 500 errors found
    if (failedRequests.length > 0) {
      console.log('Found 500+ errors:', failedRequests);
      expect(failedRequests).toHaveLength(0);
    }
  });

  test('Check multiple pages for 500 errors', async ({ page }) => {
    const pagesToTest = [
      '/',
      '/login',
      '/about',
      '/contact',
      '/dashboard',
      '/settings',
      '/profile'
    ];

    const failedPages: any[] = [];

    for (const pagePath of pagesToTest) {
      try {
        const response = await page.goto(pagePath);
        if (response && response.status() >= 500) {
          failedPages.push({
            path: pagePath,
            status: response.status(),
            statusText: response.statusText()
          });
        }
      } catch (error) {
        // Page might not exist, but we're specifically looking for 500 errors
        console.log(`Could not test ${pagePath}:`, error);
      }
    }

    if (failedPages.length > 0) {
      console.log('Pages with 500+ errors:', failedPages);
      expect(failedPages).toHaveLength(0);
    }
  });

  test('API endpoints comprehensive check', async ({ page }) => {
    const apiEndpoints = [
      '/api/health',
      '/api/auth/me',
      '/api/users/profile',
      '/api/accounts',
      '/api/dashboard/stats'
    ];

    const failedEndpoints: any[] = [];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await page.goto(endpoint);
        if (response && response.status() >= 500) {
          failedEndpoints.push({
            endpoint: endpoint,
            status: response.status(),
            statusText: response.statusText()
          });
        }
      } catch (error) {
        // Some endpoints might require auth, but we're looking for 500s specifically
        console.log(`Could not test ${endpoint}:`, error);
      }
    }

    if (failedEndpoints.length > 0) {
      console.log('API endpoints with 500+ errors:', failedEndpoints);
      expect(failedEndpoints).toHaveLength(0);
    }
  });

});