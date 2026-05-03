#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Idempotent seeder for the QA test accounts. Talks to the deployed
 * ModernBackend over HTTP using the public /signup endpoint, so it works
 * against ANY environment (local dev, staging, prod-with-ALLOW_TEST_ACCOUNTS).
 *
 * Why HTTP and not Prisma: the seed must be runnable without DB credentials.
 * As long as the backend has the @test.com auto-verify bypass deployed
 * (ModernBackend/src/routes/authRoutes.ts), this script succeeds.
 *
 * Configuration (env vars):
 *   API_BASE_URL   default: https://mwmsys-master-backend.vercel.app
 *                  override to point at local: http://localhost:3000
 *
 * Behaviour:
 *   - Tries /Api/token login first; if 200 the account is already seeded -> skip.
 *   - Else POST /signup with the role's payload.
 *   - If signup returns 409 "User already exists" -> treat as success.
 *   - For workers, links to the just-seeded employer.
 *
 * Run:
 *   node scripts/seed-test-accounts.js
 *   API_BASE_URL=http://localhost:3000 node scripts/seed-test-accounts.js
 */

// Default points at the deployed Railway backend; override via API_BASE_URL.
// Discovered from the frontend bundle on https://mwmsys-master.vercel.app .
const DEFAULT_API_BASE = process.env.API_BASE_URL
  || 'https://mwmsysmaster-production.up.railway.app';

const PASSWORD = 'Test@1234';
const PASSPORT = 'TEST123456';

// Order matters: employer must exist before worker so we can link them.
const ACCOUNTS = [
  { role: 'admin',    userId: 'qaadmin',    email: 'admin@test.com',    fullName: 'QA Admin' },
  { role: 'employer', userId: 'qaemployer', email: 'employer@test.com', fullName: 'QA Employer',
    extra: { employerName: 'QA Test Co', address: '1 Test Street', companyPhone: '+10000000000', ssmNumber: 'QA-EMP-1' } },
  { role: 'agency',   userId: 'qaagency',   email: 'agency@test.com',   fullName: 'QA Agency',
    extra: { organization: 'QA Agency Org', icOrPassport: 'QA-AGY-1', departmentId: 1, countryId: 1, contactNo: '+10000000001' } },
  { role: 'labour',   userId: 'qalabour',   email: 'labour@test.com',   fullName: 'QA Labour' },
  { role: 'embassy_source', userId: 'qaembassy', email: 'embassy@test.com', fullName: 'QA Embassy' },
  { role: 'worker',   userId: 'qaworker',   email: 'worker@test.com',   fullName: 'QA Worker',
    extra: { passportNo: PASSPORT, employerId: 'qaemployer' } },
];

async function http(method, base, path, body) {
  const url = base.replace(/\/+$/, '') + path;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  };
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: resp.status, ok: resp.ok, json };
}

async function tryLogin(base, acct) {
  const body = { username: acct.email, password: PASSWORD };
  if (acct.role === 'worker') body.passportNo = PASSPORT;
  const r = await http('POST', base, '/Api/token', body);
  return r;
}

async function signup(base, acct) {
  const payload = {
    userId: acct.userId,
    email: acct.email,
    password: PASSWORD,
    role: acct.role,
    fullName: acct.fullName,
    name: acct.fullName,
    ...(acct.extra || {}),
  };
  return http('POST', base, '/signup', payload);
}

async function ensureAccount(base, acct) {
  // 1) Already-seeded shortcut
  const login1 = await tryLogin(base, acct);
  if (login1.ok) return { acct, action: 'already-seeded', token: login1.json.access_token };

  // 2) Create
  const su = await signup(base, acct);
  const exists = su.status === 409 || /already exists/i.test(su.json?.error || '');
  if (!su.ok && !exists) {
    return { acct, action: 'failed', error: `signup ${su.status} ${JSON.stringify(su.json).slice(0,200)}` };
  }

  // 3) Re-attempt login (account is auto-verified for @test.com)
  const login2 = await tryLogin(base, acct);
  if (login2.ok) return { acct, action: exists ? 'existed-now-loggable' : 'created', token: login2.json.access_token };

  // 4) If still not loggable, the deploy may not yet have the @test.com bypass.
  //    Try the magic-OTP verify endpoint as a fallback.
  if (login2.status === 403 && /not verified/i.test(login2.json?.error || '')) {
    const v = await http('POST', base, '/Api/Auth/VerifyEmail', { userId: acct.userId, otp: '000000' });
    if (v.ok) {
      const login3 = await tryLogin(base, acct);
      if (login3.ok) return { acct, action: 'verified-via-magic-otp', token: login3.json.access_token };
    }
    return { acct, action: 'failed', error: `verify-email returned ${v.status}: ${JSON.stringify(v.json).slice(0,200)}` };
  }

  return { acct, action: 'failed', error: `login after signup: ${login2.status} ${JSON.stringify(login2.json).slice(0,200)}` };
}

async function main() {
  const base = DEFAULT_API_BASE;
  console.log(`[seed] target API: ${base}`);
  const results = [];
  for (const acct of ACCOUNTS) {
    try {
      const r = await ensureAccount(base, acct);
      results.push(r);
      const tag = r.action === 'failed' ? 'FAIL' : 'OK  ';
      console.log(`[seed] ${tag} ${acct.role.padEnd(16)} ${acct.email.padEnd(22)} -> ${r.action}${r.error ? ' :: ' + r.error : ''}`);
    } catch (e) {
      results.push({ acct, action: 'failed', error: e.message });
      console.log(`[seed] FAIL ${acct.role} ${acct.email} -> ${e.message}`);
    }
  }
  const failed = results.filter(r => r.action === 'failed');
  console.log(`\n[seed] summary: ${results.length - failed.length}/${results.length} accounts ready.`);
  if (failed.length) {
    console.log('[seed] check that the backend has the @test.com bypass deployed and that ALLOW_TEST_ACCOUNTS is not "false".');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { ACCOUNTS, ensureAccount, PASSWORD, PASSPORT };
