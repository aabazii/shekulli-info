import { test, expect } from '@playwright/test';

test.describe('Article page', () => {
  let articleId;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/articles?limit=1');
    const data = await res.json();
    const articles = data.articles || data;
    articleId = Array.isArray(articles) && articles.length > 0 ? articles[0].id : null;
  });

  // Helper: navigate to homepage first so localStorage gets populated, then go to article
  async function gotoArticle(page, id) {
    // Prime localStorage by loading homepage first
    await page.goto('/');
    await page.waitForSelector('.lead__headline', { timeout: 15_000 });
    // Now navigate to the article — localStorage has the articles cached
    await page.goto(`/article?id=${id}`);
  }

  test('article page loads with visible h1.h-display', async ({ page }) => {
    test.skip(!articleId, 'No article ID available');
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await gotoArticle(page, articleId);
    const h1 = page.locator('h1.h-display').first();
    await expect(h1).toBeVisible({ timeout: 15_000 });
    const text = await h1.textContent();
    expect(text.trim()).not.toBe('');
    expect(errors).toHaveLength(0);
  });

  test('#article-body contains text', async ({ page }) => {
    test.skip(!articleId, 'No article ID available');
    await gotoArticle(page, articleId);
    await page.waitForSelector('#article-body', { timeout: 15_000 });
    const body = page.locator('#article-body');
    await expect(body).toBeVisible();
    const text = await body.textContent();
    expect(text.trim()).not.toBe('');
  });

  test('nav .masthead__nav is present', async ({ page }) => {
    test.skip(!articleId, 'No article ID available');
    await gotoArticle(page, articleId);
    await expect(page.locator('.masthead__nav')).toBeVisible({ timeout: 15_000 });
  });

  test('clicking brand logo navigates back to homepage', async ({ page }) => {
    test.skip(!articleId, 'No article ID available');
    await gotoArticle(page, articleId);
    await page.waitForSelector('.masthead__brand', { timeout: 15_000 });
    await page.locator('.masthead__brand').click();
    // After click, should not be on the article page anymore
    await expect(page).not.toHaveURL(/article\?id=/, { timeout: 10_000 });
  });

  test('no JS errors on article page', async ({ page }) => {
    test.skip(!articleId, 'No article ID available');
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await gotoArticle(page, articleId);
    await page.waitForSelector('#article-body', { timeout: 15_000 });
    expect(errors).toHaveLength(0);
  });
});
