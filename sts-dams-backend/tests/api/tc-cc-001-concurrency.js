/**
 * TC-CC-001: Inventory Concurrent Deduction
 *
 * Usage: node tests/api/tc-cc-001-concurrency.js
 *
 * Requires: server running at localhost:8080
 * Server log "[Transaction] ..." lines appear in server terminal.
 */

const BASE = 'http://localhost:8080/api';

async function login(account, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Account_Name: account, Password: password }),
  });
  return (await res.json()).token;
}

async function api(method, path, token, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

async function main() {
  const ITEM_ID = 5;
  const INITIAL_STOCK = 15;
  const QTY_PER_REQ = 2;
  const CONCURRENCY = 10;

  // 1. Login
  const token = await login('admin', '123456');

  // 2. Adjust stock to 15
  const invBefore = await api('GET', '/inventory', token);
  const itemBefore = invBefore.body.find(i => i.Item_ID === ITEM_ID);
  const originalStock = itemBefore ? itemBefore.Current_Stock_Cache : 0;
  if (originalStock !== INITIAL_STOCK) {
    await api('POST', `/inventory/${ITEM_ID}/adjust`, token,
      { Actual_Count: INITIAL_STOCK, Reason: 'TC-CC-001' });
  }

  // 3. Find In_Progress session
  const sessionsRes = await api('GET', '/sessions', token);
  let inProgress = sessionsRes.body.filter(s => s.Session_Status === 'In_Progress');
  let sessionId;
  if (inProgress.length > 0) {
    sessionId = inProgress[0].Session_ID;
  } else {
    const candidates = sessionsRes.body.filter(
      s => s.Session_Status === 'Matching' || s.Session_Status === 'Locked_Ready'
    );
    sessionId = candidates[0].Session_ID;
    await api('PUT', `/sessions/${sessionId}/status`, token, { Session_Status: 'Locked_Ready' });
    await api('PUT', `/sessions/${sessionId}/status`, token, { Session_Status: 'In_Progress' });
  }

  // 4. 10 concurrent requests
  console.log('TC-CC-001  Inventory Concurrent Deduction');
  console.log('Stock: ' + INITIAL_STOCK + ', ' + CONCURRENCY + ' requests x -' + QTY_PER_REQ + ' each');
  console.log('');

  const startTime = Date.now();
  const promises = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    promises.push((async () => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}/sessions/${sessionId}/consumptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify([{ Item_ID: ITEM_ID, Consumed_Quantity: QTY_PER_REQ }]),
        });
        const body = await res.json().catch(() => ({}));
        return { id: i + 1, status: res.status, body, ms: Date.now() - t0 };
      } catch (e) {
        return { id: i + 1, status: 0, body: { error: e.message }, ms: Date.now() - t0 };
      }
    })());
  }
  const results = await Promise.all(promises);
  results.sort((a, b) => a.id - b.id);
  const totalMs = Date.now() - startTime;

  // 5. Print results
  for (const r of results) {
    const id = String(r.id).padStart(2);
    if (r.status === 201) {
      const msg = (r.body.message || '').substring(0, 40);
      console.log('Request #' + id + '  HTTP 201  ' + String(r.ms).padStart(4) + 'ms  ' + msg);
    } else {
      const err = (r.body.error || JSON.stringify(r.body)).substring(0, 60);
      console.log('Request #' + id + '  HTTP ' + r.status + '  ' + String(r.ms).padStart(4) + 'ms  ' + err);
    }
  }

  const passed = results.filter(r => r.status === 201).length;
  const failed = results.filter(r => r.status !== 201).length;

  // 6. Check final stock
  const invAfter = await api('GET', '/inventory', token);
  const itemAfter = invAfter.body.find(i => i.Item_ID === ITEM_ID);
  const finalStock = itemAfter ? itemAfter.Current_Stock_Cache : '?';

  console.log('');
  console.log(passed + ' passed  ' + failed + ' failed  ' + totalMs + 'ms');
  console.log('Stock: ' + INITIAL_STOCK + ' -> ' + finalStock + '  (ledger: ' + passed + ' rows)');

  // 7. Restore stock
  if (originalStock != finalStock) {
    await api('POST', `/inventory/${ITEM_ID}/adjust`, token,
      { Actual_Count: originalStock, Reason: 'TC-CC-001 restore' });
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
