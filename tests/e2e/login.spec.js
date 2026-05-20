import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('navigating to /admin redirects to a URL containing "login"', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await page.goto('/admin');
    await expect(page).toHaveURL(/login/);
    expect(errors).toHaveLength(0);
  });

  test('login page has a password input', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type=password]')).toBeVisible();
  });

  test('login page has a submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button[type=submit]')).toBeVisible();
  });

  test('entering wrong password shows #error with class "show"', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type=password]').fill('wrong-password-1234');
    await page.locator('button[type=submit]').click();
    const errorEl = page.locator('#error');
    await expect(errorEl).toHaveClass(/show/, { timeout: 10_000 });
  });

  test('brand link is present on the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.back')).toBeVisible();
  });

  test('no JS errors on login page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await page.goto('/login');
    expect(errors).toHaveLength(0);
  });
});
