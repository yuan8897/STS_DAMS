/**
 * TC-SS-001 & TC-SS-002: Session Create API Comparison
 *
 * Usage: node tests/api/tc-ss-compare.js
 * Requires: server running at localhost:8080
 *
 * Uses raw JSON strings (not JSON.stringify) to match curl behavior exactly.
 */

const BASE = 'http://localhost:8080/api';
const TOKEN_URL = `${BASE}/auth/login`;
const SESSION_URL = `${BASE}/sessions`;

const LOGIN_BODY = '{"Account_Name":"admin","Password":"123456"}';

// Use tomorrow + 19:00-23:00 UTC (same time-of-day pattern as verified-working curl)
const d = new Date();
d.setDate(d.getDate() + 1);
const dateStr = d.toISOString().split('T')[0];
const SESSION_BODY = `{"Script_ID":1,"Room_ID":3,"DM_User_ID":2,"Scheduled_Start_Time":"${dateStr}T19:00:00.000Z","Scheduled_End_Time":"${dateStr}T23:00:00.000Z","Frozen_Per_Head_Price":198.00}`;

async function post(url, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', headers, body });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data, ms: Date.now() - t0 };
}

async function main() {
  // Login
  const login = await post(TOKEN_URL, null, LOGIN_BODY);
  const token = login.body.token;

  // TC-SS-001: Success (first creation)
  console.log('---- TC-SS-001: Session Create (Success) ----');
  console.log('POST /api/sessions');
  console.log('');
  const r1 = await post(SESSION_URL, token, SESSION_BODY);
  console.log('HTTP ' + r1.status + '  (' + r1.ms + 'ms)');
  const b1 = r1.body;
  if (b1.Session_ID) {
    console.log('Session_ID: ' + b1.Session_ID);
    console.log('Session_Status: ' + b1.Session_Status);
    console.log('Scheduled_Start_Time: ' + b1.Scheduled_Start_Time);
    console.log('Scheduled_End_Time: ' + b1.Scheduled_End_Time);
    console.log('Frozen_Per_Head_Price: ' + b1.Frozen_Per_Head_Price);
    console.log('message: ' + b1.message);
  } else {
    console.log(JSON.stringify(b1, null, 2));
  }
  console.log('');

  // TC-SS-002: Time Overlap Conflict (same payload → conflict)
  console.log('---- TC-SS-002: Session Create (Time Overlap) ----');
  console.log('POST /api/sessions  (same Room_ID + time)');
  console.log('');
  const r2 = await post(SESSION_URL, token, SESSION_BODY);
  console.log('HTTP ' + r2.status + '  (' + r2.ms + 'ms)');
  const b2 = r2.body;
  if (b2.error) {
    console.log('error: ' + b2.error);
    if (b2.detail) console.log('detail: ' + b2.detail);
  } else {
    console.log(JSON.stringify(b2, null, 2));
  }
  console.log('');

  console.log('TC-SS-001: HTTP ' + r1.status + ' | TC-SS-002: HTTP ' + r2.status);
}

main().catch(e => { console.error(e.message); process.exit(1); });
