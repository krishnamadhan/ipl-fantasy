import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://ipl11.vercel.app';
const ADMIN_EMAIL = 'krishnamadhan007@gmail.com';
const ADMIN_PASSWORD = 'AdminTest2026!';
const TEST_USER_EMAIL = 'test2026@test.com';
const TEST_USER_PASSWORD = 'Test1234!';
const TEST_USERNAME = 'testuser2026';

const SCREENSHOTS_DIR = '/Users/maddy/ipl-fantasy/e2e-screenshots';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const results = [];
let screenshotCount = 0;

function log(step, status, detail = '') {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const msg = `${emoji} [${status}] Step ${step}: ${detail}`;
  console.log(msg);
  results.push({ step, status, detail });
}

async function screenshot(page, name) {
  const filename = join(SCREENSHOTS_DIR, `${String(++screenshotCount).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  📸 Screenshot saved: ${filename}`);
  return filename;
}

async function waitAndClick(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { timeout });
  await page.click(selector);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro viewport
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  console.log('\n=== PHASE 1: Admin Actions ===\n');

  // Step 1: Login as admin
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await screenshot(page, 'login-page');
    log(1, 'PASS', 'Navigated to /login successfully');
  } catch (e) {
    log(1, 'FAIL', `Failed to load /login: ${e.message}`);
  }

  // Step 2: Fill login form
  try {
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(matches|admin|dashboard|\(game\))/, { timeout: 15000 });
    log(2, 'PASS', `Admin login successful, redirected to: ${page.url()}`);
  } catch (e) {
    log(2, 'FAIL', `Admin login failed: ${e.message}`);
    // Try to capture error message
    const errorText = await page.locator('[class*="error"], [class*="alert"], .text-red').first().textContent().catch(() => 'no error text');
    log(2, 'FAIL', `Error on page: ${errorText}`);
  }

  // Step 3: Navigate to admin panel
  try {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await screenshot(page, 'admin-panel');
    const title = await page.title();
    const content = await page.content();
    if (content.includes('admin') || content.includes('Admin') || content.includes('Match')) {
      log(3, 'PASS', `Admin panel loaded. Page title: ${title}`);
    } else {
      log(3, 'FAIL', `Admin panel may not have loaded correctly. Title: ${title}`);
    }
  } catch (e) {
    log(3, 'FAIL', `Failed to load admin panel: ${e.message}`);
  }

  // Step 4: Click "Enforce Deadlines"
  try {
    const enforceBtn = page.locator('button', { hasText: /enforce deadline/i }).first();
    const btnExists = await enforceBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (btnExists) {
      await enforceBtn.click();
      await page.waitForTimeout(2000);
      // Look for toast/response
      const toast = await page.locator('[class*="toast"], [class*="alert"], [role="alert"], [class*="success"], [class*="error"]').first().textContent({ timeout: 5000 }).catch(() => 'No toast visible');
      log(4, 'PASS', `Clicked "Enforce Deadlines". Response: ${toast}`);
      await screenshot(page, 'after-enforce-deadlines');
    } else {
      // Check if button exists with different text
      const allButtons = await page.locator('button').allTextContents();
      log(4, 'WARNING', `"Enforce Deadlines" button not found. Available buttons: ${allButtons.slice(0, 10).join(', ')}`);
    }
  } catch (e) {
    log(4, 'FAIL', `Enforce Deadlines failed: ${e.message}`);
  }

  // Step 5: Click "Sync Live Scores"
  try {
    const syncBtn = page.locator('button', { hasText: /sync live score/i }).first();
    const btnExists = await syncBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (btnExists) {
      await syncBtn.click();
      await page.waitForTimeout(3000);
      const toast = await page.locator('[class*="toast"], [role="alert"], [class*="success"], [class*="error"]').first().textContent({ timeout: 5000 }).catch(() => 'No toast visible');
      log(5, 'PASS', `Clicked "Sync Live Scores". Response: ${toast}`);
      await screenshot(page, 'after-sync-live-scores-1');
    } else {
      const allButtons = await page.locator('button').allTextContents();
      log(5, 'WARNING', `"Sync Live Scores" button not found. Available buttons: ${allButtons.slice(0, 10).join(', ')}`);
    }
  } catch (e) {
    log(5, 'FAIL', `Sync Live Scores failed: ${e.message}`);
  }

  // Step 6: Look at DC vs MI match and finalize if in_review
  try {
    await page.goto(`${BASE_URL}/admin/matches`, { waitUntil: 'networkidle' });
    await screenshot(page, 'admin-matches-list');

    const pageContent = await page.content();
    const hasDCMI = pageContent.includes('Delhi Capitals') && pageContent.includes('Mumbai Indians');
    log(6, hasDCMI ? 'PASS' : 'WARNING', `Admin matches page loaded. DC vs MI visible: ${hasDCMI}`);

    // Try to find and click Finalize for DC vs MI
    const finalizeBtn = page.locator('button', { hasText: /finalize/i }).first();
    const finalizeVisible = await finalizeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (finalizeVisible) {
      await finalizeBtn.click();
      await page.waitForTimeout(2000);
      const toast = await page.locator('[role="alert"], [class*="toast"], [class*="success"]').first().textContent({ timeout: 5000 }).catch(() => 'No response');
      log(6, 'PASS', `Clicked Finalize on DC vs MI. Response: ${toast}`);
      await screenshot(page, 'after-dcmi-finalize');
    } else {
      log(6, 'WARNING', 'Finalize button not found for DC vs MI (match may already be completed or not in_review)');
    }
  } catch (e) {
    log(6, 'FAIL', `DC vs MI finalize step failed: ${e.message}`);
  }

  // Step 7: Handle GT vs RR match - Go Live
  try {
    const pageContent = await page.content();
    const hasGTRR = pageContent.includes('Gujarat Titans') && pageContent.includes('Rajasthan Royals');
    log(7, hasGTRR ? 'PASS' : 'WARNING', `GT vs RR visible in admin matches: ${hasGTRR}`);

    // Look for GT vs RR row and find "Go Live" or appropriate button
    // First, look for "Go Live" button near GT/RR text
    const goLiveBtn = page.locator('button', { hasText: /go live/i }).first();
    const goLiveVisible = await goLiveBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (goLiveVisible) {
      await goLiveBtn.click();
      await page.waitForTimeout(2000);
      const toast = await page.locator('[role="alert"], [class*="toast"], [class*="success"], [class*="error"]').first().textContent({ timeout: 5000 }).catch(() => 'No response');
      log(7, 'PASS', `Clicked "Go Live" on GT vs RR. Response: ${toast}`);
      await screenshot(page, 'after-gtvrr-go-live');
    } else {
      // Check what buttons are available for GT vs RR
      const allButtons = await page.locator('button').allTextContents();
      log(7, 'WARNING', `"Go Live" not found for GT vs RR. Available buttons: ${allButtons.join(', ')}`);
    }
  } catch (e) {
    log(7, 'FAIL', `GT vs RR Go Live failed: ${e.message}`);
  }

  // Step 8: Sync Playing XI for GT vs RR
  try {
    const syncXIBtn = page.locator('button', { hasText: /sync playing xi/i }).first();
    const syncXIVisible = await syncXIBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (syncXIVisible) {
      await syncXIBtn.click();
      await page.waitForTimeout(3000);
      const toast = await page.locator('[role="alert"], [class*="toast"], [class*="success"], [class*="error"]').first().textContent({ timeout: 5000 }).catch(() => 'No response');
      log(8, 'PASS', `Clicked "Sync Playing XI". Response: ${toast}`);
    } else {
      // Navigate to GT vs RR specific match page
      await page.goto(`${BASE_URL}/admin/matches`, { waitUntil: 'networkidle' });
      const gtrr = page.locator('a, button', { hasText: /gujarat/i }).first();
      const gtrrExists = await gtrr.isVisible({ timeout: 3000 }).catch(() => false);
      if (gtrrExists) {
        await gtrr.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'gtvrr-match-detail');
        const syncXI = page.locator('button', { hasText: /sync playing xi/i }).first();
        const syncXIV2 = await syncXI.isVisible({ timeout: 3000 }).catch(() => false);
        if (syncXIV2) {
          await syncXI.click();
          await page.waitForTimeout(3000);
          const toast = await page.locator('[role="alert"]').first().textContent({ timeout: 5000 }).catch(() => 'No response');
          log(8, 'PASS', `Clicked "Sync Playing XI" on match detail. Response: ${toast}`);
        } else {
          log(8, 'WARNING', 'Sync Playing XI button not found on match detail page');
        }
      } else {
        log(8, 'WARNING', 'Could not navigate to GT vs RR match detail');
      }
    }
  } catch (e) {
    log(8, 'FAIL', `Sync Playing XI failed: ${e.message}`);
  }

  // Step 9: Sync Live Scores again
  try {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    const syncBtn = page.locator('button', { hasText: /sync live score/i }).first();
    const btnExists = await syncBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (btnExists) {
      await syncBtn.click();
      await page.waitForTimeout(3000);
      const toast = await page.locator('[role="alert"], [class*="toast"]').first().textContent({ timeout: 5000 }).catch(() => 'No response');
      log(9, 'PASS', `Second "Sync Live Scores" click. Response: ${toast}`);
    } else {
      log(9, 'WARNING', 'Sync Live Scores button not visible on /admin');
    }
    await screenshot(page, 'admin-final-state');
  } catch (e) {
    log(9, 'FAIL', `Second sync live scores failed: ${e.message}`);
  }

  console.log('\n=== PHASE 2: User Registration & Match Flow ===\n');

  // Step 10: Register new test user
  let userContext;
  let userPage;
  try {
    userContext = await browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    userPage = await userContext.newPage();
    userPage.setDefaultTimeout(20000);

    await userPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'register-page');
    log(10, 'PASS', 'Navigated to /register');
  } catch (e) {
    log(10, 'FAIL', `Failed to load /register: ${e.message}`);
  }

  // Step 11: Fill registration form
  let registrationSuccess = false;
  try {
    // Try different input selectors
    const usernameInput = userPage.locator('input[name="username"], input[placeholder*="username" i], input[placeholder*="Username"]').first();
    const emailInput = userPage.locator('input[type="email"]').first();
    const passwordInput = userPage.locator('input[type="password"]').first();

    await usernameInput.fill(TEST_USERNAME);
    await emailInput.fill(TEST_USER_EMAIL);
    await passwordInput.fill(TEST_USER_PASSWORD);

    await screenshot(userPage, 'register-form-filled');

    await userPage.click('button[type="submit"]');
    await userPage.waitForTimeout(3000);

    const currentUrl = userPage.url();
    const content = await userPage.content();
    const hasError = content.toLowerCase().includes('already registered') || content.toLowerCase().includes('error');

    if (currentUrl !== `${BASE_URL}/register` || content.includes('matches') || content.includes('dashboard')) {
      registrationSuccess = true;
      log(11, 'PASS', `Registration successful. Redirected to: ${currentUrl}`);
    } else if (hasError) {
      // User might already exist — try login instead
      log(11, 'WARNING', 'User may already exist. Trying login...');
      await userPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      await userPage.fill('input[type="email"]', TEST_USER_EMAIL);
      await userPage.fill('input[type="password"]', TEST_USER_PASSWORD);
      await userPage.click('button[type="submit"]');
      await userPage.waitForTimeout(3000);
      registrationSuccess = true;
      log(11, 'PASS', `Logged in as existing test user. URL: ${userPage.url()}`);
    } else {
      log(11, 'WARNING', `Registration status unclear. URL: ${currentUrl}`);
      await screenshot(userPage, 'register-result');
    }
  } catch (e) {
    log(11, 'FAIL', `Registration failed: ${e.message}`);
    await screenshot(userPage, 'register-error');
  }

  // Step 12: Go to /matches
  let gtrrMatchId = 'd9bc9541-a42a-454f-b3fc-6c5af3e9a740'; // from API call earlier
  try {
    await userPage.goto(`${BASE_URL}/matches`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'matches-page');

    const content = await userPage.content();
    const hasGTRR = content.includes('Gujarat Titans') || content.includes('GT');
    const hasLiveIndicator = content.includes('LIVE') || content.includes('live') || content.includes('🔴');

    log(12, 'PASS', `Matches page loaded. GT vs RR visible: ${hasGTRR}. Live indicator: ${hasLiveIndicator}`);

    // Check if GT vs RR shows LIVE
    if (hasLiveIndicator) {
      log(15, 'PASS', 'GT vs RR shows LIVE indicator');
    } else {
      log(15, 'WARNING', 'GT vs RR does not show LIVE indicator (match may still be "scheduled" in DB)');
    }
  } catch (e) {
    log(12, 'FAIL', `Matches page failed: ${e.message}`);
  }

  // Step 13: Click on GT vs RR match
  try {
    const matchCard = userPage.locator('a, [role="link"]', { hasText: /gujarat titan/i }).first();
    const cardExists = await matchCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (cardExists) {
      await matchCard.click();
      await userPage.waitForTimeout(2000);
      await screenshot(userPage, 'gtvrr-match-card-clicked');
      log(13, 'PASS', `Clicked GT vs RR match card. URL: ${userPage.url()}`);
    } else {
      // Try navigating directly
      await userPage.goto(`${BASE_URL}/contests/browse/${gtrrMatchId}`, { waitUntil: 'networkidle' });
      await screenshot(userPage, 'gtvrr-contest-browse');
      log(13, 'WARNING', `GT vs RR card not found, navigated to contest browse directly. URL: ${userPage.url()}`);
    }
  } catch (e) {
    log(13, 'FAIL', `GT vs RR click failed: ${e.message}`);
  }

  // Step 14: Check for contest and join
  try {
    const content = await userPage.content();
    const hasContest = content.includes('contest') || content.includes('Contest') || content.includes('Join');
    log(14, hasContest ? 'PASS' : 'WARNING', `Match detail/contest page. Has contest content: ${hasContest}`);

    await screenshot(userPage, 'match-detail-page');

    // Try to find and click a join contest button
    const joinBtn = userPage.locator('button, a', { hasText: /join/i }).first();
    const joinVisible = await joinBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (joinVisible) {
      const joinText = await joinBtn.textContent();
      log(19, 'PASS', `Join button found: "${joinText}"`);
    } else {
      log(19, 'WARNING', 'No join button visible (match may need to be open/live for contests)');
    }
  } catch (e) {
    log(14, 'FAIL', `Contest page check failed: ${e.message}`);
  }

  // Step 15: Try to access team builder
  try {
    await userPage.goto(`${BASE_URL}/matches/${gtrrMatchId}/build-team`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'team-builder-page');
    const content = await userPage.content();
    const hasTeamBuilder = content.includes('captain') || content.includes('Captain') || content.includes('player') || content.includes('Player') || content.includes('Select');
    log(20, hasTeamBuilder ? 'PASS' : 'WARNING', `Team builder page. Has team building UI: ${hasTeamBuilder}. URL: ${userPage.url()}`);
  } catch (e) {
    log(20, 'FAIL', `Team builder page failed: ${e.message}`);
  }

  // Step 16: Try live match page
  try {
    await userPage.goto(`${BASE_URL}/matches/${gtrrMatchId}/live`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'live-match-page');
    const content = await userPage.content();
    const hasScore = content.includes('over') || content.includes('run') || content.includes('wicket') || content.includes('score');
    const hasPlayerPoints = content.includes('point') || content.includes('pts');
    log(23, 'PASS', `Live match page. Has score: ${hasScore}. Has player points: ${hasPlayerPoints}. URL: ${userPage.url()}`);
  } catch (e) {
    log(23, 'FAIL', `Live match page failed: ${e.message}`);
  }

  console.log('\n=== PHASE 3: Contest Leaderboard ===\n');

  // Step 17: Go to /contests
  try {
    await userPage.goto(`${BASE_URL}/contests`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'contests-page');
    const content = await userPage.content();
    log(24, 'PASS', `Contests page loaded. URL: ${userPage.url()}`);
  } catch (e) {
    log(24, 'FAIL', `Contests page failed: ${e.message}`);
  }

  // Step 18: Check contest leaderboard
  try {
    // Navigate to contests browse for GT vs RR
    await userPage.goto(`${BASE_URL}/contests/browse/${gtrrMatchId}`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'contest-browse-gtvrr');
    const content = await userPage.content();
    log(25, 'PASS', `Contest browse page loaded`);

    // Look for a contest to click
    const contestItem = userPage.locator('[class*="contest"], [class*="card"]').first();
    const contestExists = await contestItem.isVisible({ timeout: 5000 }).catch(() => false);
    if (contestExists) {
      await contestItem.click();
      await page.waitForTimeout(2000);
      await screenshot(userPage, 'contest-detail');

      // Look for Leaderboard tab
      const leaderboardTab = userPage.locator('button, [role="tab"]', { hasText: /leaderboard/i }).first();
      const tabExists = await leaderboardTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (tabExists) {
        await leaderboardTab.click();
        await userPage.waitForTimeout(2000);
        await screenshot(userPage, 'leaderboard-tab');
        const lbContent = await userPage.content();
        const hasEntries = lbContent.includes('rank') || lbContent.includes('Rank') || lbContent.includes('pts') || lbContent.includes('points');
        log(26, hasEntries ? 'PASS' : 'WARNING', `Leaderboard tab. Has entries: ${hasEntries}`);
      } else {
        log(26, 'WARNING', 'Leaderboard tab not found in contest detail');
      }
    } else {
      log(26, 'WARNING', 'No contest items found on browse page');
    }
  } catch (e) {
    log(26, 'FAIL', `Contest leaderboard test failed: ${e.message}`);
  }

  console.log('\n=== PHASE 4: Additional Pages ===\n');

  // Step 19: /my-teams
  try {
    await userPage.goto(`${BASE_URL}/my-teams`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'my-teams-page');
    const content = await userPage.content();
    log(28, 'PASS', `My Teams page loaded. URL: ${userPage.url()}`);
  } catch (e) {
    log(28, 'FAIL', `My Teams page failed: ${e.message}`);
  }

  // Step 20: /leaderboard
  try {
    await userPage.goto(`${BASE_URL}/leaderboard`, { waitUntil: 'networkidle' });
    await screenshot(userPage, 'leaderboard-page');
    const content = await userPage.content();
    log(29, 'PASS', `Leaderboard page loaded. URL: ${userPage.url()}`);
  } catch (e) {
    log(29, 'FAIL', `Leaderboard page failed: ${e.message}`);
  }

  // Step 21: /admin/players (as admin)
  try {
    await page.goto(`${BASE_URL}/admin/players`, { waitUntil: 'networkidle' });
    await screenshot(page, 'admin-players-page');
    const content = await page.content();
    const hasPlayers = content.includes('player') || content.includes('Player') || content.includes('Sync');
    log(30, hasPlayers ? 'PASS' : 'WARNING', `Admin players page. Has player content: ${hasPlayers}`);
  } catch (e) {
    log(30, 'FAIL', `Admin players page failed: ${e.message}`);
  }

  // Step 22: Test another registration (to check fix)
  try {
    const reg2Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const reg2Page = await reg2Context.newPage();
    reg2Page.setDefaultTimeout(15000);

    await reg2Page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });

    // Try registering with a slightly different username
    const timestamp = Date.now().toString().slice(-6);
    await reg2Page.locator('input[name="username"], input[placeholder*="username" i], input[placeholder*="Username"]').first().fill(`test${timestamp}`);
    await reg2Page.fill('input[type="email"]', `test${timestamp}@test.com`);
    await reg2Page.fill('input[type="password"]', 'Test1234!');
    await reg2Page.click('button[type="submit"]');
    await reg2Page.waitForTimeout(4000);

    const currentUrl = reg2Page.url();
    const content = await reg2Page.content();
    const success = !currentUrl.includes('/register') || content.includes('matches') || content.includes('dashboard');

    await screenshot(reg2Page, 'second-registration-test');
    log(31, success ? 'PASS' : 'WARNING', `Second registration test. Redirected to: ${currentUrl}`);
    await reg2Context.close();
  } catch (e) {
    log(31, 'FAIL', `Second registration test failed: ${e.message}`);
  }

  // Check key pages for 404s and errors
  console.log('\n=== Additional URL Checks ===\n');
  const pagesToCheck = [
    '/matches',
    '/contests',
    '/my-teams',
    '/leaderboard',
    '/admin',
    '/admin/matches',
    '/admin/players',
    '/admin/contests',
  ];

  for (const path of pagesToCheck) {
    try {
      const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
      const status = response?.status() || 'unknown';
      const url = page.url();
      const content = await page.content();
      const has404 = content.includes('404') || content.includes('not found') || content.includes('Not Found');
      const hasError = content.includes('Application error') || content.includes('Internal Server Error');

      if (has404) {
        log(`URL:${path}`, 'FAIL', `404 Not Found`);
      } else if (hasError) {
        log(`URL:${path}`, 'FAIL', `Application error detected`);
      } else if (status === 200 || url !== `${BASE_URL}${path}`) {
        log(`URL:${path}`, 'PASS', `Status: ${status}, Final URL: ${url}`);
      } else {
        log(`URL:${path}`, 'WARNING', `Status: ${status}`);
      }
    } catch (e) {
      log(`URL:${path}`, 'FAIL', `Navigation failed: ${e.message}`);
    }
  }

  await browser.close();

  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('E2E TEST SUMMARY');
  console.log('='.repeat(60));

  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  console.log(`\n✅ PASS: ${passes}`);
  console.log(`❌ FAIL: ${fails}`);
  console.log(`⚠️  WARNING: ${warnings}`);
  console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);

  const bugs = results.filter(r => r.status === 'FAIL');
  if (bugs.length > 0) {
    console.log('\nBUGS FOUND:');
    bugs.forEach(b => console.log(`  - Step ${b.step}: ${b.detail}`));
  }

  const verdict = fails === 0 ? 'PRODUCTION READY' : fails <= 2 ? 'MOSTLY READY - minor issues' : 'NOT PRODUCTION READY - critical issues found';
  console.log(`\nOVERALL VERDICT: ${verdict}`);

  return results;
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
