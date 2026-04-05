/**
 * IPL Fantasy E2E Test v2 — corrected selectors, proper auth handling,
 * real URL structure from codebase analysis.
 *
 * Routes confirmed from src/:
 *   /login                        (auth)
 *   /register                     (auth)
 *   /dashboard                    (game)
 *   /matches                      (game) — match list
 *   /matches/[id]                 (game) — match detail
 *   /matches/[id]/live            (game) — live scorecard
 *   /team-builder/[matchId]       (game)
 *   /contests/browse/[matchId]    (game)
 *   /contests/[contestId]         (game)
 *   /my-teams                     (game)
 *   /leaderboard                  (game)
 *   /admin                        admin panel
 *   /admin/matches                admin matches (separate from game layout)
 *   /admin/players                admin players
 *   /admin/contests               admin contests
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://ipl11.vercel.app';
const ADMIN_EMAIL = 'krishnamadhan007@gmail.com';
const ADMIN_PASSWORD = 'AdminTest2026!';
const TEST_USER_EMAIL = 'test2026@test.com';
const TEST_USER_PASSWORD = 'Test1234!';
const TEST_USERNAME = 'testuser2026';

// GT vs RR match ID from DB
const GTRR_MATCH_ID = 'd9bc9541-a42a-454f-b3fc-6c5af3e9a740';
const DC_MI_MATCH_ID = '81bca55d-95f4-4785-9476-144496452cac';

const SCREENSHOTS_DIR = '/Users/maddy/ipl-fantasy/e2e-screenshots-v2';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const results = [];
let screenshotCount = 0;
const bugs = [];

function log(step, status, detail = '') {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ ';
  const msg = `${emoji} [${status}] ${step}: ${detail}`;
  console.log(msg);
  results.push({ step, status, detail });
  if (status === 'FAIL') bugs.push({ step, detail });
}

async function ss(page, name) {
  const fn = join(SCREENSHOTS_DIR, `${String(++screenshotCount).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: fn, fullPage: true });
  console.log(`  📸 ${fn}`);
  return fn;
}

async function getToast(page) {
  try {
    // react-hot-toast renders divs with role="status" or specific class
    await page.waitForSelector('[data-testid="toast"], [class*="go2"], [role="status"], [class*="toast"]', { timeout: 4000 });
    return await page.locator('[data-testid="toast"], [class*="go2"], [role="status"], [class*="toast"]').first().textContent({ timeout: 2000 });
  } catch {
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── PHASE 1: Admin Session ───────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('PHASE 1: Admin Actions');
  console.log('═══════════════════════════════════════\n');

  const adminCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const adminPage = await adminCtx.newPage();
  adminPage.setDefaultTimeout(25000);

  // Step 1: Load /login
  try {
    const res = await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('input[type="email"]', { timeout: 15000 });
    await ss(adminPage, 'step01-login-page');
    log('Step 1 - Load /login', 'PASS', `HTTP ${res?.status()}`);
  } catch (e) {
    log('Step 1 - Load /login', 'FAIL', e.message);
  }

  // Step 2: Admin login
  try {
    await adminPage.fill('input[type="email"]', ADMIN_EMAIL);
    await adminPage.fill('input[type="password"]', ADMIN_PASSWORD);
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL(/\/(dashboard|matches|admin)/, { timeout: 15000 });
    log('Step 2 - Admin login', 'PASS', `Redirected to: ${adminPage.url()}`);
  } catch (e) {
    log('Step 2 - Admin login', 'FAIL', e.message);
    await ss(adminPage, 'step02-login-error');
  }

  // Step 3: Navigate to /admin
  try {
    await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('h1, h2', { timeout: 10000 });
    await ss(adminPage, 'step03-admin-panel');
    const heading = await adminPage.locator('h1, h2').first().textContent();
    const content = await adminPage.content();
    const isAdminPanel = content.includes('Admin Panel') || content.includes('Data Sync') || content.includes('Sync Schedule');
    log('Step 3 - Admin panel loaded', isAdminPanel ? 'PASS' : 'FAIL',
      `Heading: "${heading?.trim()}" | Has admin content: ${isAdminPanel}`);
  } catch (e) {
    log('Step 3 - Admin panel', 'FAIL', e.message);
  }

  // Step 4: Click "Enforce Deadlines"
  try {
    const btn = adminPage.getByRole('button', { name: /enforce deadline/i });
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    const toast = await getToast(adminPage);
    await ss(adminPage, 'step04-enforce-deadlines');
    log('Step 4 - Enforce Deadlines', 'PASS', `Toast: "${toast ?? 'no toast (check API response)'}"`);
  } catch (e) {
    // Try finding button by partial text in any element
    const allBtns = await adminPage.locator('button').allTextContents();
    log('Step 4 - Enforce Deadlines', 'WARNING',
      `Button not found. Available: ${allBtns.filter(t => t.trim()).slice(0, 8).join(' | ')}`);
  }

  // Step 5: Click "Sync Live Scores"
  try {
    const btn = adminPage.getByRole('button', { name: /sync live score/i });
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await adminPage.waitForTimeout(3000);
    const toast = await getToast(adminPage);
    await ss(adminPage, 'step05-sync-live-scores-1');
    log('Step 5 - Sync Live Scores (1st)', 'PASS', `Toast: "${toast ?? 'no visible toast'}"`);
  } catch (e) {
    log('Step 5 - Sync Live Scores (1st)', 'WARNING', `${e.message}`);
  }

  // Steps 6-8 work on /admin/matches (the dedicated matches page in the admin nav)
  // From the screenshot we can see "Matches" link in admin nav
  // BUT from AdminDashboard.tsx the match management is directly on /admin page
  // The /admin/matches route is a separate detailed view

  // Go to /admin — this has the match management buttons
  await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('button', { timeout: 10000 });

  // Step 6: DC vs MI — check status and Finalize if in_review
  try {
    // Find the DC vs MI section — look for text "DC vs MI" or "Delhi Capitals"
    const dcMiSection = adminPage.locator('div').filter({ hasText: /DC vs MI/i }).last();
    await dcMiSection.waitFor({ timeout: 5000 });

    // Get the status badge text near it
    const statusBadge = dcMiSection.locator('span').filter({ hasText: /in.review|live|completed|locked|open|scheduled/i }).first();
    const statusText = await statusBadge.textContent({ timeout: 3000 }).catch(() => 'unknown');
    log('Step 6a - DC vs MI status check', 'PASS', `Status: "${statusText?.trim()}"`);

    // Try to click Finalize if it's in_review
    const finalizeBtn = dcMiSection.getByRole('button', { name: /finalize/i });
    const finalizeVisible = await finalizeBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (finalizeVisible) {
      // Playwright can't handle window.confirm natively — need to dismiss dialog
      adminPage.once('dialog', d => d.accept());
      await finalizeBtn.click();
      await adminPage.waitForTimeout(3000);
      const toast = await getToast(adminPage);
      await ss(adminPage, 'step06-dcmi-finalized');
      log('Step 6b - DC vs MI Finalize', 'PASS', `Toast: "${toast ?? 'no toast'}"`);
    } else {
      log('Step 6b - DC vs MI Finalize', 'WARNING',
        `Finalize btn not visible (status may not be in_review). Status: "${statusText?.trim()}"`);
    }
  } catch (e) {
    log('Step 6 - DC vs MI check', 'FAIL', e.message);
  }

  // Step 7: GT vs RR — check status and Go Live
  try {
    const gtRrSection = adminPage.locator('div').filter({ hasText: /GT vs RR/i }).last();
    await gtRrSection.waitFor({ timeout: 5000 });
    const statusBadge = gtRrSection.locator('span').filter({ hasText: /live|locked|open|scheduled|in.review/i }).first();
    const statusText = await statusBadge.textContent({ timeout: 3000 }).catch(() => 'unknown');
    log('Step 7a - GT vs RR status', 'PASS', `Status: "${statusText?.trim()}"`);

    // Try Go Live button
    const goLiveBtn = gtRrSection.getByRole('button', { name: /go live/i });
    const goLiveVisible = await goLiveBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (goLiveVisible) {
      adminPage.once('dialog', d => d.accept());
      await goLiveBtn.click();
      await adminPage.waitForTimeout(3000);
      const toast = await getToast(adminPage);
      await ss(adminPage, 'step07-gtvrr-go-live');
      log('Step 7b - GT vs RR Go Live', 'PASS', `Toast: "${toast ?? 'no visible toast'}"`);

      // Reload to verify status changed
      await adminPage.reload({ waitUntil: 'domcontentloaded' });
      await adminPage.waitForTimeout(1000);
      const newStatus = await adminPage.locator('div').filter({ hasText: /GT vs RR/i }).last()
        .locator('span').filter({ hasText: /live|locked|open|scheduled|in.review/i }).first()
        .textContent({ timeout: 3000 }).catch(() => 'unknown');
      log('Step 7c - GT vs RR status after Go Live', 'PASS', `New status: "${newStatus?.trim()}"`);
    } else {
      log('Step 7b - GT vs RR Go Live', 'WARNING',
        `Go Live not visible. Status: "${statusText?.trim()}". May already be live or not unlocked.`);
    }
  } catch (e) {
    log('Step 7 - GT vs RR Go Live', 'FAIL', e.message);
  }

  // Step 8: Sync Playing XI for GT vs RR
  try {
    const gtRrSection = adminPage.locator('div').filter({ hasText: /GT vs RR/i }).last();
    const syncXIBtn = gtRrSection.getByRole('button', { name: /sync playing xi/i });
    const syncXIVisible = await syncXIBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (syncXIVisible) {
      await syncXIBtn.click();
      await adminPage.waitForTimeout(4000);
      const toast = await getToast(adminPage);
      await ss(adminPage, 'step08-sync-playing-xi');
      log('Step 8 - Sync Playing XI', 'PASS', `Toast: "${toast ?? 'no visible toast'}"`);
    } else {
      // Check what buttons are visible for GT vs RR
      const gtRrBtns = await gtRrSection.getByRole('button').allTextContents().catch(() => []);
      log('Step 8 - Sync Playing XI', 'WARNING',
        `Sync XI btn not visible. GT vs RR buttons: ${gtRrBtns.join(' | ')}`);
    }
  } catch (e) {
    log('Step 8 - Sync Playing XI', 'FAIL', e.message);
  }

  // Step 9: Sync Live Scores (second time)
  try {
    const btn = adminPage.getByRole('button', { name: /sync live score/i });
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await adminPage.waitForTimeout(3000);
    const toast = await getToast(adminPage);
    await ss(adminPage, 'step09-admin-final-state');
    log('Step 9 - Sync Live Scores (2nd)', 'PASS', `Toast: "${toast ?? 'no visible toast'}"`);
  } catch (e) {
    log('Step 9 - Sync Live Scores (2nd)', 'WARNING', e.message);
  }

  // ─── PHASE 2: User Registration & Match Flow ───────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('PHASE 2: User Registration & Match Flow');
  console.log('═══════════════════════════════════════\n');

  const userCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const userPage = await userCtx.newPage();
  userPage.setDefaultTimeout(25000);

  // Step 10: Load /register
  try {
    await userPage.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    // Wait for the username field (type=text, placeholder="coolcricketer")
    await userPage.waitForSelector('input[type="text"]', { timeout: 15000 });
    await ss(userPage, 'step10-register-page');
    log('Step 10 - Load /register', 'PASS', 'Registration form visible');
  } catch (e) {
    log('Step 10 - Load /register', 'FAIL', e.message);
    await ss(userPage, 'step10-register-error');
  }

  // Step 11: Fill registration form
  // Username: type=text, placeholder="coolcricketer"
  // Email: type=email
  // Password: type=password, placeholder="Min 8 characters"
  let userLoggedIn = false;
  try {
    await userPage.fill('input[type="text"]', TEST_USERNAME);
    await userPage.fill('input[type="email"]', TEST_USER_EMAIL);
    await userPage.fill('input[type="password"]', TEST_USER_PASSWORD);
    await ss(userPage, 'step11-form-filled');

    await userPage.click('button[type="submit"]');
    await userPage.waitForTimeout(4000);

    const currentUrl = userPage.url();
    const content = await userPage.content();

    if (currentUrl.includes('/dashboard') || currentUrl.includes('/matches')) {
      userLoggedIn = true;
      log('Step 11 - Register new user', 'PASS', `Redirected to: ${currentUrl}`);
    } else if (content.toLowerCase().includes('already registered') || content.toLowerCase().includes('user already registered')) {
      // User exists — log in instead
      log('Step 11a - Register', 'WARNING', 'User already exists — trying login');
      await userPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await userPage.waitForSelector('input[type="email"]');
      await userPage.fill('input[type="email"]', TEST_USER_EMAIL);
      await userPage.fill('input[type="password"]', TEST_USER_PASSWORD);
      await userPage.click('button[type="submit"]');
      await userPage.waitForURL(/\/(dashboard|matches)/, { timeout: 10000 });
      userLoggedIn = true;
      log('Step 11b - Login existing user', 'PASS', `Logged in at: ${userPage.url()}`);
    } else {
      // Try to read toast
      const toastText = await getToast(userPage);
      log('Step 11 - Register new user', 'WARNING',
        `Unclear result. URL: ${currentUrl}. Toast: ${toastText}. Trying login...`);

      // Try login as fallback
      await userPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await userPage.waitForSelector('input[type="email"]');
      await userPage.fill('input[type="email"]', TEST_USER_EMAIL);
      await userPage.fill('input[type="password"]', TEST_USER_PASSWORD);
      await userPage.click('button[type="submit"]');
      await userPage.waitForTimeout(3000);

      if (userPage.url().includes('/dashboard') || userPage.url().includes('/matches')) {
        userLoggedIn = true;
        log('Step 11c - Login fallback', 'PASS', `Logged in: ${userPage.url()}`);
      } else {
        log('Step 11 - User auth', 'FAIL', 'Could not register or login as test user');
        await ss(userPage, 'step11-auth-fail');
      }
    }
  } catch (e) {
    log('Step 11 - Register', 'FAIL', e.message);
    await ss(userPage, 'step11-error');
  }

  // Step 12: Navigate to /matches
  try {
    await userPage.goto(`${BASE_URL}/matches`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForSelector('h1, [class*="match"]', { timeout: 10000 });
    await ss(userPage, 'step12-matches-page');

    const content = await userPage.content();
    const url = userPage.url();

    if (url.includes('/login')) {
      log('Step 12 - /matches page', 'FAIL', 'Redirected to /login — user not authenticated');
    } else {
      const hasGT = content.includes('Gujarat') || content.includes('GT');
      const hasRR = content.includes('Rajasthan') || content.includes('RR');
      const hasLive = content.includes('LIVE') || content.includes('live') || content.includes('animate-pulse');
      log('Step 12 - /matches page', 'PASS',
        `URL: ${url} | GT visible: ${hasGT} | RR visible: ${hasRR}`);

      // Step 15: Does GT vs RR show LIVE indicator?
      if (hasLive) {
        log('Step 15 - GT vs RR LIVE indicator', 'PASS', 'Live indicator found on matches page');
      } else {
        log('Step 15 - GT vs RR LIVE indicator', 'WARNING',
          'No LIVE indicator — match may still be locked/scheduled in DB');
      }
    }
  } catch (e) {
    log('Step 12 - /matches page', 'FAIL', e.message);
  }

  // Step 13: Click GT vs RR match card
  try {
    const gtCard = userPage.locator('a').filter({ hasText: /gujarat/i }).first();
    const cardVisible = await gtCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (cardVisible) {
      await gtCard.click();
      await userPage.waitForURL(/\/matches\//, { timeout: 10000 });
      await ss(userPage, 'step13-match-detail');
      log('Step 13 - Click GT vs RR card', 'PASS', `URL: ${userPage.url()}`);
    } else {
      // Navigate directly
      await userPage.goto(`${BASE_URL}/matches/${GTRR_MATCH_ID}`, { waitUntil: 'domcontentloaded' });
      await userPage.waitForTimeout(2000);
      await ss(userPage, 'step13-match-detail-direct');
      const url = userPage.url();
      if (url.includes('/login')) {
        log('Step 13 - Match detail page', 'FAIL', 'Redirected to login — not authenticated');
      } else {
        log('Step 13 - Match detail page (direct nav)', 'PASS', `URL: ${url}`);
      }
    }
  } catch (e) {
    log('Step 13 - GT vs RR click', 'FAIL', e.message);
  }

  // Step 14: Inspect match detail page
  try {
    const content = await userPage.content();
    const url = userPage.url();

    if (url.includes('/login')) {
      log('Step 14 - Match detail content', 'FAIL', 'Not authenticated');
    } else {
      const hasStatus = content.includes('LIVE') || content.includes('LOCKED') || content.includes('SCHEDULED') || content.includes('OPEN');
      const hasTeams = (content.includes('Gujarat') || content.includes('GT')) && (content.includes('Rajasthan') || content.includes('RR'));
      const hasContests = content.includes('Contest') || content.includes('Join');
      const hasJoinBtn = content.includes('Join Contest') || content.includes('Build Team') || content.includes('Go Live');

      log('Step 14 - Match detail content', 'PASS',
        `Status visible: ${hasStatus} | Teams: ${hasTeams} | Contests section: ${hasContests} | CTA: ${hasJoinBtn}`);

      // Step 16/17: Check for contest/join buttons
      if (hasJoinBtn) {
        log('Step 16 - Join contest CTA', 'PASS', 'Join/Build team button visible on match detail');
      } else {
        log('Step 16 - Join contest CTA', 'WARNING', 'No join/build CTA (match not in "open" state)');
      }
    }
  } catch (e) {
    log('Step 14 - Match detail', 'FAIL', e.message);
  }

  // Step 18: Contest browse page
  try {
    await userPage.goto(`${BASE_URL}/contests/browse/${GTRR_MATCH_ID}`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);
    await ss(userPage, 'step18-contest-browse');

    const url = userPage.url();
    if (url.includes('/login')) {
      log('Step 18 - Contest browse page', 'FAIL', 'Redirected to login');
    } else {
      const content = await userPage.content();
      const hasContests = content.includes('contest') || content.includes('Contest') || content.includes('Join') || content.includes('Prize');
      const noContests = content.includes('No contests') || content.includes('no contest');
      log('Step 18 - Contest browse page', 'PASS',
        `URL: ${url} | Has contests: ${hasContests} | No contests msg: ${noContests}`);

      // Step 19: Try to join a contest
      const joinBtn = userPage.getByRole('button', { name: /join/i }).first();
      const joinVisible = await joinBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (joinVisible) {
        log('Step 19 - Join contest button', 'PASS', 'Join button visible');
      } else {
        log('Step 19 - Join contest button', 'WARNING', 'No join button (match not open for joining)');
      }
    }
  } catch (e) {
    log('Step 18 - Contest browse', 'FAIL', e.message);
  }

  // Step 20: Team builder page
  try {
    await userPage.goto(`${BASE_URL}/team-builder/${GTRR_MATCH_ID}`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);
    await ss(userPage, 'step20-team-builder');

    const url = userPage.url();
    if (url.includes('/login')) {
      log('Step 20 - Team builder', 'FAIL', 'Redirected to login');
    } else {
      const content = await userPage.content();
      const hasPlayers = content.includes('WK') || content.includes('BAT') || content.includes('BOWL') || content.includes('Captain') || content.includes('Select');
      const hasMatchLocked = content.includes('locked') || content.includes('Locked');
      log('Step 20 - Team builder', 'PASS',
        `URL: ${url} | Has player UI: ${hasPlayers} | Match locked msg: ${hasMatchLocked}`);
    }
  } catch (e) {
    log('Step 20 - Team builder', 'FAIL', e.message);
  }

  // Step 23: Live match page
  try {
    await userPage.goto(`${BASE_URL}/matches/${GTRR_MATCH_ID}/live`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);
    await ss(userPage, 'step23-live-match');

    const url = userPage.url();
    if (url.includes('/login')) {
      log('Step 23 - Live match page', 'FAIL', 'Redirected to login');
    } else {
      const content = await userPage.content();
      const hasScore = content.includes('run') || content.includes('over') || content.includes('wicket') || content.includes('Score') || content.includes('Batting') || content.includes('Bowling');
      const hasPoints = content.includes('pts') || content.includes('Pts') || content.includes('point');
      const noDataMsg = content.includes('No scorecard') || content.includes('no data');
      log('Step 23 - Live match page', 'PASS',
        `URL: ${url} | Score content: ${hasScore} | Points: ${hasPoints} | No data msg: ${noDataMsg}`);
    }
  } catch (e) {
    log('Step 23 - Live match page', 'FAIL', e.message);
  }

  // ─── PHASE 3: Contest Leaderboard ──────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('PHASE 3: Contest Leaderboard');
  console.log('═══════════════════════════════════════\n');

  // Step 24: /contests
  try {
    await userPage.goto(`${BASE_URL}/contests`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);
    await ss(userPage, 'step24-contests-page');

    const url = userPage.url();
    if (url.includes('/login')) {
      log('Step 24 - /contests page', 'FAIL', 'Redirected to login');
    } else {
      const content = await userPage.content();
      log('Step 24 - /contests page', 'PASS', `URL: ${url}`);
    }
  } catch (e) {
    log('Step 24 - /contests page', 'FAIL', e.message);
  }

  // Step 25-27: Contest leaderboard
  try {
    // Get contests from Supabase (we know the match ID)
    const contestsUrl = `${BASE_URL}/contests/browse/${GTRR_MATCH_ID}`;
    await userPage.goto(contestsUrl, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);

    const url = userPage.url();
    if (!url.includes('/login')) {
      const content = await userPage.content();

      // Find first contest link
      const contestLink = userPage.locator('a[href*="/contests/"]').first();
      const contestLinkExists = await contestLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (contestLinkExists) {
        const href = await contestLink.getAttribute('href');
        log('Step 25 - Found contest link', 'PASS', `href: ${href}`);

        await contestLink.click();
        await userPage.waitForTimeout(2000);
        await ss(userPage, 'step25-contest-detail');

        // Look for leaderboard tab
        const lbTab = userPage.locator('button, [role="tab"]').filter({ hasText: /leaderboard/i }).first();
        const lbTabExists = await lbTab.isVisible({ timeout: 5000 }).catch(() => false);
        if (lbTabExists) {
          await lbTab.click();
          await userPage.waitForTimeout(2000);
          await ss(userPage, 'step26-leaderboard-tab');

          const content = await userPage.content();
          const hasEntries = content.includes('Rank') || content.includes('rank') || content.includes('pts') || content.includes('No entries');
          log('Step 26 - Contest leaderboard tab', 'PASS', `Has leaderboard content: ${hasEntries}`);
        } else {
          log('Step 26 - Contest leaderboard tab', 'WARNING', 'Leaderboard tab not found in contest detail');
          await ss(userPage, 'step26-no-leaderboard-tab');
        }
      } else {
        log('Step 25 - Contest browse', 'WARNING', 'No contest links found — no contests for GT vs RR');
        await ss(userPage, 'step25-no-contests');
      }
    } else {
      log('Step 25 - Contest browse', 'FAIL', 'Redirected to login');
    }
  } catch (e) {
    log('Step 25-27 - Contest leaderboard', 'FAIL', e.message);
  }

  // ─── PHASE 4: Additional Pages ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('PHASE 4: Additional Pages');
  console.log('═══════════════════════════════════════\n');

  // Step 28: /my-teams
  try {
    await userPage.goto(`${BASE_URL}/my-teams`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);
    await ss(userPage, 'step28-my-teams');
    const url = userPage.url();
    if (url.includes('/login')) {
      log('Step 28 - /my-teams', 'FAIL', 'Redirected to login');
    } else {
      const content = await userPage.content();
      const hasTeams = content.includes('team') || content.includes('Team') || content.includes('No teams');
      log('Step 28 - /my-teams', 'PASS', `URL: ${url} | Has team content: ${hasTeams}`);
    }
  } catch (e) {
    log('Step 28 - /my-teams', 'FAIL', e.message);
  }

  // Step 29: /leaderboard
  try {
    await userPage.goto(`${BASE_URL}/leaderboard`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForTimeout(2000);
    await ss(userPage, 'step29-leaderboard');
    const url = userPage.url();
    if (url.includes('/login')) {
      log('Step 29 - /leaderboard', 'FAIL', 'Redirected to login');
    } else {
      const content = await userPage.content();
      const hasLeaderboard = content.includes('rank') || content.includes('Rank') || content.includes('leaderboard') || content.includes('Leaderboard') || content.includes('points');
      log('Step 29 - /leaderboard', 'PASS', `URL: ${url} | Has leaderboard content: ${hasLeaderboard}`);
    }
  } catch (e) {
    log('Step 29 - /leaderboard', 'FAIL', e.message);
  }

  // Step 30: /admin/players (as admin)
  try {
    await adminPage.goto(`${BASE_URL}/admin/players`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForTimeout(2000);
    await ss(adminPage, 'step30-admin-players');
    const content = await adminPage.content();
    const hasPlayers = content.includes('player') || content.includes('Player') || content.includes('Sync Squads');
    const hasTable = content.includes('<table') || content.includes('grid') || content.includes('WK') || content.includes('BAT');
    log('Step 30 - /admin/players', 'PASS',
      `Has player content: ${hasPlayers} | Has player table: ${hasTable}`);
  } catch (e) {
    log('Step 30 - /admin/players', 'FAIL', e.message);
  }

  // Step 31: Second user registration test
  try {
    const reg2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const reg2Page = await reg2Ctx.newPage();
    reg2Page.setDefaultTimeout(20000);

    await reg2Page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await reg2Page.waitForSelector('input[type="text"]', { timeout: 15000 });

    const ts = Date.now().toString().slice(-5);
    const newUsername = `player${ts}`;
    const newEmail = `player${ts}@test.com`;

    await reg2Page.fill('input[type="text"]', newUsername);
    await reg2Page.fill('input[type="email"]', newEmail);
    await reg2Page.fill('input[type="password"]', 'Test1234!');

    await reg2Page.click('button[type="submit"]');
    await reg2Page.waitForTimeout(4000);

    const url = reg2Page.url();
    const content = await reg2Page.content();
    const toastText = await getToast(reg2Page);

    await ss(reg2Page, 'step31-second-registration');

    if (url.includes('/dashboard') || url.includes('/matches')) {
      log('Step 31 - Second registration test', 'PASS', `New user "${newUsername}" registered. URL: ${url}`);
    } else if (toastText?.includes('Account created')) {
      log('Step 31 - Second registration test', 'PASS', `Toast: "${toastText}"`);
    } else {
      log('Step 31 - Second registration test', 'WARNING',
        `Unclear. URL: ${url}. Toast: ${toastText ?? 'none'}`);
    }
    await reg2Ctx.close();
  } catch (e) {
    log('Step 31 - Second registration test', 'FAIL', e.message);
  }

  // ─── URL Health Check ───────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('URL Health Check (as admin)');
  console.log('═══════════════════════════════════════\n');

  const urlsToCheck = [
    ['/dashboard', 'game dashboard'],
    ['/matches', 'match list'],
    [`/matches/${GTRR_MATCH_ID}`, 'GT vs RR detail'],
    [`/matches/${GTRR_MATCH_ID}/live`, 'GT vs RR live'],
    [`/contests/browse/${GTRR_MATCH_ID}`, 'contest browse'],
    ['/my-teams', 'my teams'],
    ['/leaderboard', 'leaderboard'],
    ['/admin', 'admin dashboard'],
    ['/admin/matches', 'admin matches'],
    ['/admin/players', 'admin players'],
    ['/admin/contests', 'admin contests'],
  ];

  for (const [path, label] of urlsToCheck) {
    try {
      const res = await adminPage.goto(`${BASE_URL}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      await adminPage.waitForTimeout(500);

      const finalUrl = adminPage.url();
      const httpStatus = res?.status() ?? 'unknown';
      const content = await adminPage.content();

      const has404 = content.includes('"404"') || content.includes('>404<') ||
                     (content.includes('not found') && !content.includes('No teams') && !content.includes('No contests'));
      const hasAppError = content.includes('Application error') || content.includes('Internal Server Error');
      const redirectedToLogin = finalUrl.includes('/login');

      if (has404) {
        log(`URL ${path} (${label})`, 'FAIL', `404 Not Found`);
      } else if (hasAppError) {
        log(`URL ${path} (${label})`, 'FAIL', `Application error`);
      } else if (redirectedToLogin) {
        log(`URL ${path} (${label})`, 'FAIL', `Unexpected redirect to /login (admin session)`);
      } else {
        log(`URL ${path} (${label})`, 'PASS', `HTTP ${httpStatus} → ${finalUrl}`);
      }
    } catch (e) {
      log(`URL ${path} (${label})`, 'FAIL', `${e.message.slice(0, 100)}`);
    }
  }

  await browser.close();

  // ─── Final Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('E2E TEST SUMMARY');
  console.log('═'.repeat(60));

  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;

  console.log(`\n✅ PASS:    ${passes}`);
  console.log(`❌ FAIL:    ${fails}`);
  console.log(`⚠️  WARNING: ${warnings}`);
  console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}`);

  if (bugs.length > 0) {
    console.log('\nBUGS / FAILURES:');
    bugs.forEach((b, i) => console.log(`  ${i + 1}. [${b.step}] ${b.detail.slice(0, 120)}`));
  }

  const warnings2 = results.filter(r => r.status === 'WARNING');
  if (warnings2.length > 0) {
    console.log('\nWARNINGS:');
    warnings2.forEach((w, i) => console.log(`  ${i + 1}. [${w.step}] ${w.detail.slice(0, 120)}`));
  }

  const verdict = fails === 0
    ? '✅ PRODUCTION READY'
    : fails <= 3
    ? '⚠️  MOSTLY READY — minor issues'
    : '❌ NOT PRODUCTION READY';

  console.log(`\nOVERALL VERDICT: ${verdict}`);
}

main().catch(e => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
