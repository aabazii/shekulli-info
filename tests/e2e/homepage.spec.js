import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('page title contains "Shekulli"', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await page.goto('/');
    await expect(page).toHaveTitle(/Shekulli/);
    expect(errors).toHaveLength(0);
  });

  test('nav has all 7 category links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.masthead__nav');
    const categories = ['Politikë', 'Kosovë', 'Botë', 'Ekonomi', 'Sport', 'Kulturë', 'Opinion'];
    for (const cat of categories) {
      await expect(nav.getByRole('link', { name: cat, exact: true })).toBeVisible();
    }
  });

  test('#main-content is not empty after articles load', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    const content = page.locator('#main-content');
    await expect(content).not.toBeEmpty();
  });

  test('at least one .lead__headline link is visible with non-empty text', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    const headline = page.locator('.lead__headline').first();
    await expect(headline).toBeVisible();
    const link = headline.locator('a').first();
    await expect(link).toBeVisible();
    const text = await link.textContent();
    expect(text.trim()).not.toBe('');
  });

  test('at least one .section-strip__title is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    const strip = page.locator('.section-strip__title').first();
    await expect(strip).toBeVisible();
  });

  test('clicking a .lead__headline a navigates to article?id=', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    const link = page.locator('.lead__headline a').first();
    await link.click();
    await expect(page).toHaveURL(/article\?id=/);
  });

  test('no JavaScript errors on the page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    expect(errors).toHaveLength(0);
  });

  test('mobile viewport: page renders and #main-content has content', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    const content = page.locator('#main-content');
    await expect(content).not.toBeEmpty();
  });
});
