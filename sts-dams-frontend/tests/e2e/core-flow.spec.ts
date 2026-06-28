/**
 * STS-DAMS E2E 测试 — 核心端到端流程
 *
 * 前置条件：
 *   1. SQL Server 运行中 + 数据库已部署
 *   2. 后端运行在 localhost:8080
 *   3. 前端运行在 localhost:3000
 *
 * 安装：npm install -D @playwright/test && npx playwright install
 * 运行：npx playwright test tests/e2e/core-flow.spec.ts
 */
import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:3000';

test.describe('STS-DAMS 端到端核心流程', () => {

  test('管理员登录 → 时空大盘 → API 健康', async ({ page }) => {
    // 1. 访问首页，应跳转到登录页
    await page.goto(FRONTEND);
    await expect(page).toHaveURL(/\/login/);

    // 2. 输入管理员账号登录
    await page.fill('input[placeholder*="手机号"], input[placeholder*="昵称"]', 'admin');
    await page.fill('input[placeholder*="密码"]', '123456');
    await page.click('button[type="submit"]');

    // 3. 应跳转到店长端时空管理大盘
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

    // 4. 页面应包含标题
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('玩家登录 → 拼车大厅 → 查看场次', async ({ page }) => {
    // 1. 玩家登录
    await page.goto(`${FRONTEND}/login`);
    await page.fill('input[placeholder*="手机号"], input[placeholder*="昵称"]', 'player_xiaoming');
    await page.fill('input[placeholder*="密码"]', '123456');
    await page.click('button[type="submit"]');

    // 2. 应跳转到拼车大厅
    await page.waitForURL(/\/lobby/, { timeout: 10000 });

    // 3. 应有场次卡片
    await expect(page.locator('[class*="card"], [class*="Card"], [class*="session"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('DM 登录 → 我的带场 → 场次列表', async ({ page }) => {
    // 1. DM 登录
    await page.goto(`${FRONTEND}/login`);
    await page.fill('input[placeholder*="手机号"], input[placeholder*="昵称"]', 'dm_ye');
    await page.fill('input[placeholder*="密码"]', '123456');
    await page.click('button[type="submit"]');

    // 2. 应跳转到 DM 端
    await page.waitForURL(/\/dm\/sessions/, { timeout: 10000 });

    // 3. 应有场次列表
    await expect(page.locator('[class*="card"], [class*="Card"], [class*="session"], table').first()).toBeVisible({ timeout: 8000 });
  });

  test('登录失败 → 错误提示', async ({ page }) => {
    await page.goto(`${FRONTEND}/login`);
    await page.fill('input[placeholder*="手机号"], input[placeholder*="昵称"]', 'admin');
    await page.fill('input[placeholder*="密码"]', 'wrong_password');
    await page.click('button[type="submit"]');

    // 应显示错误提示
    await expect(page.locator('[class*="toast"], [class*="error"], [class*="alert"], [role="alert"]').first()).toBeVisible({ timeout: 5000 });
  });

});
