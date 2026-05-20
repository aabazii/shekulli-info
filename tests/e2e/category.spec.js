import { test, expect } from '@playwright/test';

test.describe('Category page', () => {
  test('clicking Sport nav link navigates to category?cat=Sport', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await page.goto('/');
    const sportLink = page.locator('.masthead__nav').getByRole('link', { name: 'Sport', exact: true });
    await expect(sportLink).toBeVisible();
    await sportLink.click();
    await expect(page).toHaveURL(/category\?cat=Sport/);
    expect(errors).toHaveLength(0);
  });

  test('#cat-header is visible and contains "Sport"', async ({ page }) => {
    await page.goto('/category?cat=Sport');
    const header = page.locator('#cat-header');
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header).toContainText('Sport');
  });

  test('#cat-articles is not empty', async ({ page }) => {
    await page.goto('/category?cat=Sport');
    await page.waitForSelector('#cat-articles', { timeout: 15_000 });
    const articles = page.locator('#cat-articles');
    await expect(articles).not.toBeEmpty({ timeout: 15_000 });
  });

  test('at least one article link goes to article?id=', async ({ page }) => {
    await page.goto('/category?cat=Sport');
    await page.waitForSelector('#cat-articles', { timeout: 15_000 });
    const articleLink = page.locator('#cat-articles a[href*="article?id="]').first();
    await expect(articleLink).toBeVisible({ timeout: 15_000 });
  });

  test('homepage has all 7 category nav links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.masthead__nav');
    const categories = ['Politikë', 'Kosovë', 'Botë', 'Ekonomi', 'Sport', 'Kulturë', 'Opinion'];
    for (const cat of categories) {
      await expect(nav.getByRole('link', { name: cat, exact: true })).toBeVisible();
    }
  });

  test('no JS errors on category page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await page.goto('/category?cat=Sport');
    await page.waitForSelector('#cat-articles', { timeout: 15_000 });
    expect(errors).toHaveLength(0);
  });
});
