# 우리집 재무관리 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small self-hosted Node.js web app where a couple pastes card/account transaction exports and views a monthly spending dashboard.

**Architecture:** Single Express server rendering EJS templates server-side, backed by one SQLite file via `better-sqlite3`. No frontend framework, no build step, no auth.

**Tech Stack:** Node.js, Express, EJS, better-sqlite3, Chart.js (via CDN script tag). Tests use Node's built-in `node --test` + `assert` — no test framework dependency.

**Spec:** [docs/superpowers/specs/2026-08-26-household-finance-dashboard-design.md](../specs/2026-08-26-household-finance-dashboard-design.md)

## Global Constraints

- No login/auth — app is reachable by anyone with the URL.
- No category/tagging feature — out of scope for this plan.
- No bank/card API integration — input is manual paste only.
- Amounts are stored as positive integers representing an expense (원 단위).
- Single SQLite file (`better-sqlite3`) is the only datastore — no ORM.
- No build step — EJS server-rendered views, Chart.js loaded from CDN.

---

## File Structure

```
package.json
.gitignore
server.js              -- Express app + routes
db.js                   -- SQLite schema + CRUD
lib/
  parser.js              -- paste parsing: delimiter detect, mapping, hash
  aggregate.js             -- monthly aggregation for dashboard
views/
  dashboard.ejs
  import-form.ejs
  import-preview.ejs
  import-result.ejs
test/
  parser.test.js
  aggregate.test.js
  db.test.js
README.md
```

---

### Task 1: Project scaffold + database layer

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `db.js`
- Test: `test/db.test.js`

**Interfaces:**
- Produces: `openDb(dbPath)`, `listSources(db)`, `createSource(db, name, type)`, `saveColumnMapping(db, sourceId, mapping)`, `insertTransactions(db, sourceId, rows)` returning `{inserted, duplicates}`, `getTransactionsForMonth(db, yearMonth)`, `getAllTransactions(db)`.

- [ ] **Step 1: Init project and install dependencies**

```bash
cd "C:\Users\광일\Documents\guidebook\clode\우리집재무관리"
npm init -y
npm install express ejs better-sqlite3
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
data.db
data.db-journal
data.db-wal
data.db-shm
```

- [ ] **Step 3: Update `package.json` scripts**

Edit the generated `package.json` so `scripts` is:

```json
"scripts": {
  "start": "node server.js",
  "test": "node --test"
}
```

- [ ] **Step 4: Write the failing test**

Create `test/db.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { openDb, createSource, insertTransactions, getAllTransactions, listSources, saveColumnMapping } = require('../db');

test('createSource + insertTransactions dedupes by raw_hash', () => {
  const db = openDb(':memory:');
  const sourceId = createSource(db, '국민카드', 'card');

  const rows = [
    { date: '2026-08-01', description: '스타벅스', amount: 5000, raw_hash: 'h1' },
    { date: '2026-08-02', description: '이마트', amount: 30000, raw_hash: 'h2' },
  ];

  const first = insertTransactions(db, sourceId, rows);
  assert.strictEqual(first.inserted, 2);
  assert.strictEqual(first.duplicates, 0);

  // re-inserting the same rows (e.g. overlapping paste) must be ignored
  const second = insertTransactions(db, sourceId, rows);
  assert.strictEqual(second.inserted, 0);
  assert.strictEqual(second.duplicates, 2);

  assert.strictEqual(getAllTransactions(db).length, 2);
});

test('saveColumnMapping persists JSON on the source row', () => {
  const db = openDb(':memory:');
  const sourceId = createSource(db, '마이너스통장', 'account');
  saveColumnMapping(db, sourceId, ['date', 'description', 'amount']);

  const source = listSources(db).find(s => s.id === sourceId);
  assert.deepStrictEqual(JSON.parse(source.column_mapping), ['date', 'description', 'amount']);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../db'`

- [ ] **Step 6: Write `db.js`**

```js
const Database = require('better-sqlite3');

function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      column_mapping TEXT
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES sources(id),
      date TEXT NOT NULL,
      description TEXT,
      amount INTEGER NOT NULL,
      raw_hash TEXT NOT NULL UNIQUE
    );
  `);
  return db;
}

function listSources(db) {
  return db.prepare('SELECT id, name, type, column_mapping FROM sources ORDER BY id').all();
}

function createSource(db, name, type) {
  const result = db.prepare('INSERT INTO sources (name, type, column_mapping) VALUES (?, ?, NULL)').run(name, type);
  return result.lastInsertRowid;
}

function saveColumnMapping(db, sourceId, mapping) {
  db.prepare('UPDATE sources SET column_mapping = ? WHERE id = ?').run(JSON.stringify(mapping), sourceId);
}

function insertTransactions(db, sourceId, transactions) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions (source_id, date, description, amount, raw_hash)
    VALUES (@source_id, @date, @description, @amount, @raw_hash)
  `);
  let inserted = 0;
  const run = db.transaction((rows) => {
    for (const row of rows) {
      const result = insert.run({ source_id: sourceId, ...row });
      if (result.changes > 0) inserted++;
    }
  });
  run(transactions);
  return { inserted, duplicates: transactions.length - inserted };
}

function getTransactionsForMonth(db, yearMonth) {
  return db.prepare(`
    SELECT t.id, t.date, t.description, t.amount, s.name AS source_name, s.id AS source_id
    FROM transactions t
    JOIN sources s ON s.id = t.source_id
    WHERE t.date LIKE ?
    ORDER BY t.date
  `).all(`${yearMonth}%`);
}

function getAllTransactions(db) {
  return db.prepare(`
    SELECT t.id, t.date, t.description, t.amount, s.name AS source_name, s.id AS source_id
    FROM transactions t JOIN sources s ON s.id = t.source_id
    ORDER BY t.date
  `).all();
}

module.exports = {
  openDb, listSources, createSource, saveColumnMapping,
  insertTransactions, getTransactionsForMonth, getAllTransactions,
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore db.js test/db.test.js
git commit -m "feat: add sqlite schema and CRUD layer with dedup"
```

---

### Task 2: Paste parser

**Files:**
- Create: `lib/parser.js`
- Test: `test/parser.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `detectDelimiter(text)`, `parseGrid(text)`, `normalizeDate(raw)`, `normalizeAmount(raw)`, `computeHash(sourceId, date, description, amount)`, `applyMapping(grid, mapping, sourceId, hasHeader)` returning `{rows, errors}` where each row is `{date, description, amount, raw_hash}` and each error is `{rowIndex, reason, raw}`.

- [ ] **Step 1: Write the failing test**

Create `test/parser.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { detectDelimiter, parseGrid, normalizeDate, normalizeAmount, computeHash, applyMapping } = require('../lib/parser');

test('detectDelimiter picks tab when present, else comma', () => {
  assert.strictEqual(detectDelimiter('2026.08.01\t스타벅스\t5,000'), '\t');
  assert.strictEqual(detectDelimiter('2026.08.01,스타벅스,5000'), ',');
});

test('parseGrid splits rows and columns, drops blank lines', () => {
  const grid = parseGrid('a\tb\tc\n\n1\t2\t3\n');
  assert.deepStrictEqual(grid, [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('normalizeDate accepts dot/dash/slash separated 8-digit dates', () => {
  assert.strictEqual(normalizeDate('2026.08.01'), '2026-08-01');
  assert.strictEqual(normalizeDate('2026-08-01'), '2026-08-01');
  assert.strictEqual(normalizeDate('2026/08/01'), '2026-08-01');
  assert.strictEqual(normalizeDate('08/01'), null);
  assert.strictEqual(normalizeDate('not a date'), null);
});

test('normalizeAmount strips commas/currency and takes absolute value', () => {
  assert.strictEqual(normalizeAmount('5,000'), 5000);
  assert.strictEqual(normalizeAmount('-30,000원'), 30000);
  assert.strictEqual(normalizeAmount('abc'), null);
});

test('computeHash is stable for identical inputs', () => {
  const h1 = computeHash(1, '2026-08-01', '스타벅스', 5000);
  const h2 = computeHash(1, '2026-08-01', '스타벅스', 5000);
  const h3 = computeHash(1, '2026-08-01', '스타벅스', 5001);
  assert.strictEqual(h1, h2);
  assert.notStrictEqual(h1, h3);
});

test('applyMapping maps columns by role, skips header, flags bad rows', () => {
  const grid = [
    ['날짜', '내용', '금액'],
    ['2026.08.01', '스타벅스', '5,000'],
    ['이상한날짜', '이마트', '30,000'],
  ];
  const { rows, errors } = applyMapping(grid, ['date', 'description', 'amount'], 1, true);

  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(rows[0], {
    date: '2026-08-01',
    description: '스타벅스',
    amount: 5000,
    raw_hash: computeHash(1, '2026-08-01', '스타벅스', 5000),
  });

  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].reason, 'invalid date');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../lib/parser'`

- [ ] **Step 3: Write `lib/parser.js`**

```js
const crypto = require('crypto');

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  return firstLine.includes('\t') ? '\t' : ',';
}

function parseGrid(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => line.split(delimiter).map(cell => cell.trim()));
}

function normalizeDate(raw) {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (digits.length !== 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const m = Number(month), d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

function normalizeAmount(raw) {
  const cleaned = (raw || '').replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Math.round(Math.abs(Number(cleaned)));
  return Number.isFinite(value) ? value : null;
}

function computeHash(sourceId, date, description, amount) {
  return crypto.createHash('sha1').update(`${sourceId}|${date}|${description}|${amount}`).digest('hex');
}

function applyMapping(grid, mapping, sourceId, hasHeader) {
  const dataRows = hasHeader ? grid.slice(1) : grid;
  const rows = [];
  const errors = [];
  dataRows.forEach((cols, index) => {
    const fields = { date: null, description: '', amount: null };
    mapping.forEach((role, colIndex) => {
      if (!role || role === 'ignore') return;
      fields[role] = cols[colIndex];
    });
    const date = normalizeDate(fields.date);
    const amount = normalizeAmount(fields.amount);
    if (!date || amount == null) {
      errors.push({ rowIndex: index, reason: !date ? 'invalid date' : 'invalid amount', raw: cols });
      return;
    }
    const description = (fields.description || '').trim();
    rows.push({ date, description, amount, raw_hash: computeHash(sourceId, date, description, amount) });
  });
  return { rows, errors };
}

module.exports = { detectDelimiter, parseGrid, normalizeDate, normalizeAmount, computeHash, applyMapping };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all parser tests + Task 1's db tests)

- [ ] **Step 5: Commit**

```bash
git add lib/parser.js test/parser.test.js
git commit -m "feat: add paste parser with column mapping and dedup hash"
```

---

### Task 3: Monthly aggregation

**Files:**
- Create: `lib/aggregate.js`
- Test: `test/aggregate.test.js`

**Interfaces:**
- Consumes: transaction rows shaped like `db.getAllTransactions()` output: `{date, description, amount, source_name, source_id}`.
- Produces: `recentMonthTotals(transactions, count)` returning `[{month, total}]` sorted ascending by month, most recent `count` months only.

- [ ] **Step 1: Write the failing test**

Create `test/aggregate.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { recentMonthTotals } = require('../lib/aggregate');

test('recentMonthTotals sums amounts per month and keeps only the last N months', () => {
  const transactions = [
    { date: '2026-06-01', amount: 1000, source_name: 'A' },
    { date: '2026-06-15', amount: 2000, source_name: 'B' },
    { date: '2026-07-01', amount: 500, source_name: 'A' },
    { date: '2026-08-01', amount: 700, source_name: 'A' },
  ];

  const result = recentMonthTotals(transactions, 2);
  assert.deepStrictEqual(result, [
    { month: '2026-07', total: 500 },
    { month: '2026-08', total: 700 },
  ]);
});

test('recentMonthTotals returns empty array for no transactions', () => {
  assert.deepStrictEqual(recentMonthTotals([], 6), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../lib/aggregate'`

- [ ] **Step 3: Write `lib/aggregate.js`**

```js
function aggregateByMonth(transactions) {
  const byMonth = new Map();
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, 0);
    byMonth.set(month, byMonth.get(month) + t.amount);
  }
  return byMonth;
}

function recentMonthTotals(transactions, count) {
  const byMonth = aggregateByMonth(transactions);
  const months = [...byMonth.keys()].sort();
  const recent = months.slice(-count);
  return recent.map(month => ({ month, total: byMonth.get(month) }));
}

module.exports = { aggregateByMonth, recentMonthTotals };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all aggregate tests + Task 1 + Task 2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/aggregate.js test/aggregate.test.js
git commit -m "feat: add monthly aggregation for dashboard"
```

---

### Task 4: Server bootstrap + dashboard route

**Files:**
- Create: `server.js`
- Create: `views/dashboard.ejs`

**Interfaces:**
- Consumes: `db.js` (`openDb`, `getTransactionsForMonth`, `getAllTransactions`, `listSources`), `lib/aggregate.js` (`recentMonthTotals`).
- Produces: an Express `app` (exported for potential reuse), listening on `process.env.PORT || 3000`, with `GET /` rendering the dashboard.

- [ ] **Step 1: Write `server.js`**

```js
const express = require('express');
const path = require('path');
const {
  openDb, listSources, createSource, saveColumnMapping,
  insertTransactions, getTransactionsForMonth, getAllTransactions,
} = require('./db');
const { parseGrid, applyMapping } = require('./lib/parser');
const { recentMonthTotals } = require('./lib/aggregate');

const db = openDb(process.env.DB_PATH || path.join(__dirname, 'data.db'));
const app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

app.get('/', (req, res) => {
  const month = req.query.month || currentYearMonth();
  const transactions = getTransactionsForMonth(db, month);

  const bySourceMap = new Map();
  let total = 0;
  for (const t of transactions) {
    bySourceMap.set(t.source_name, (bySourceMap.get(t.source_name) || 0) + t.amount);
    total += t.amount;
  }

  const recent = recentMonthTotals(getAllTransactions(db), 6);

  res.render('dashboard', {
    month,
    transactions,
    total,
    bySource: [...bySourceMap.entries()],
    recent,
  });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));
}

module.exports = { app, db };
```

- [ ] **Step 2: Write `views/dashboard.ejs`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>우리집 재무관리</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <nav><a href="/">대시보드</a> | <a href="/import">거래내역 붙여넣기</a></nav>
  <h1><%= month %> 요약</h1>
  <form method="get">
    <input type="month" name="month" value="<%= month %>" onchange="this.form.submit()">
  </form>
  <p>총액: <%= total.toLocaleString() %>원</p>
  <ul>
    <% bySource.forEach(([name, amount]) => { %>
      <li><%= name %>: <%= amount.toLocaleString() %>원</li>
    <% }) %>
  </ul>
  <table border="1" cellpadding="4">
    <tr><th>날짜</th><th>출처</th><th>내용</th><th>금액</th></tr>
    <% transactions.forEach(t => { %>
      <tr>
        <td><%= t.date %></td>
        <td><%= t.source_name %></td>
        <td><%= t.description %></td>
        <td><%= t.amount.toLocaleString() %></td>
      </tr>
    <% }) %>
  </table>
  <canvas id="trend" width="400" height="150"></canvas>
  <script>
    const recent = <%- JSON.stringify(recent) %>;
    new Chart(document.getElementById('trend'), {
      type: 'bar',
      data: {
        labels: recent.map(r => r.month),
        datasets: [{ label: '월별 총액', data: recent.map(r => r.total) }],
      },
    });
  </script>
</body>
</html>
```

- [ ] **Step 3: Manually verify the server starts and renders**

Run:

```bash
npm start
```

In another terminal:

```bash
curl -s http://localhost:3000/ | grep "요약"
```

Expected: output contains `<h1>2026-08 요약</h1>` (or the current year-month), process logs `listening on 3000`. Stop the server (Ctrl+C) when confirmed.

- [ ] **Step 4: Commit**

```bash
git add server.js views/dashboard.ejs
git commit -m "feat: add server bootstrap and monthly dashboard view"
```

---

### Task 5: Paste-import flow (form, preview, save)

**Files:**
- Modify: `server.js`
- Create: `views/import-form.ejs`
- Create: `views/import-preview.ejs`
- Create: `views/import-result.ejs`

**Interfaces:**
- Consumes: `db.js` (`listSources`, `createSource`, `saveColumnMapping`, `insertTransactions`), `lib/parser.js` (`parseGrid`, `applyMapping`).
- Produces: `GET /import`, `POST /import/preview`, `POST /import/save` routes.

- [ ] **Step 1: Add import routes to `server.js`**

Insert after the `GET /` route defined in Task 4, before the `if (require.main === module)` block:

```js
app.get('/import', (req, res) => {
  res.render('import-form', { sources: listSources(db) });
});

app.post('/import/preview', (req, res) => {
  const { sourceId, newSourceName, newSourceType, pastedText, hasHeader } = req.body;
  let resolvedSourceId = Number(sourceId);
  if (!resolvedSourceId && newSourceName) {
    resolvedSourceId = createSource(db, newSourceName, newSourceType || 'card');
  }
  const source = listSources(db).find(s => s.id === resolvedSourceId);
  const grid = parseGrid(pastedText);
  const savedMapping = source && source.column_mapping ? JSON.parse(source.column_mapping) : null;

  res.render('import-preview', {
    sourceId: resolvedSourceId,
    pastedText,
    hasHeader: hasHeader === 'on',
    grid: grid.slice(0, 20),
    columnCount: grid[0] ? grid[0].length : 0,
    savedMapping,
  });
});

app.post('/import/save', (req, res) => {
  const sourceId = Number(req.body.sourceId);
  const hasHeader = req.body.hasHeader === 'on';
  const pastedText = req.body.pastedText;

  const mapping = [];
  let i = 0;
  while (req.body[`col${i}`] !== undefined) {
    mapping.push(req.body[`col${i}`]);
    i++;
  }

  const grid = parseGrid(pastedText);
  const { rows, errors } = applyMapping(grid, mapping, sourceId, hasHeader);
  const { inserted, duplicates } = insertTransactions(db, sourceId, rows);
  saveColumnMapping(db, sourceId, mapping);

  res.render('import-result', { inserted, duplicates, errors });
});
```

- [ ] **Step 2: Write `views/import-form.ejs`**

```html
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>거래내역 붙여넣기</title></head>
<body>
  <nav><a href="/">대시보드</a> | <a href="/import">거래내역 붙여넣기</a></nav>
  <h1>거래내역 붙여넣기</h1>
  <form method="post" action="/import/preview">
    <label>출처
      <select name="sourceId">
        <option value="">-- 새 출처 --</option>
        <% sources.forEach(s => { %>
          <option value="<%= s.id %>"><%= s.name %></option>
        <% }) %>
      </select>
    </label>
    <fieldset>
      <legend>새 출처 (기존 출처를 선택했다면 비워두세요)</legend>
      <input type="text" name="newSourceName" placeholder="예: 국민카드">
      <select name="newSourceType">
        <option value="card">카드</option>
        <option value="account">계좌</option>
      </select>
    </fieldset>
    <label><input type="checkbox" name="hasHeader" checked> 첫 줄은 헤더</label><br>
    <textarea name="pastedText" rows="15" cols="80" placeholder="엑셀에서 복사한 내용을 붙여넣으세요"></textarea><br>
    <button type="submit">미리보기</button>
  </form>
</body>
</html>
```

- [ ] **Step 3: Write `views/import-preview.ejs`**

```html
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>붙여넣기 미리보기</title></head>
<body>
  <h1>미리보기 (상위 <%= grid.length %>행)</h1>
  <form method="post" action="/import/save">
    <input type="hidden" name="sourceId" value="<%= sourceId %>">
    <input type="hidden" name="pastedText" value="<%= pastedText %>">
    <% if (hasHeader) { %><input type="hidden" name="hasHeader" value="on"><% } %>
    <table border="1" cellpadding="4">
      <tr>
        <% for (let c = 0; c < columnCount; c++) { %>
          <th>
            <select name="col<%= c %>">
              <% ['ignore','date','description','amount'].forEach(role => { %>
                <option value="<%= role %>" <%= (savedMapping && savedMapping[c] === role) ? 'selected' : '' %>><%= role %></option>
              <% }) %>
            </select>
          </th>
        <% } %>
      </tr>
      <% grid.forEach(row => { %>
        <tr><% row.forEach(cell => { %><td><%= cell %></td><% }) %></tr>
      <% }) %>
    </table>
    <button type="submit">저장</button>
  </form>
</body>
</html>
```

- [ ] **Step 4: Write `views/import-result.ejs`**

```html
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>저장 결과</title></head>
<body>
  <h1>저장 완료</h1>
  <p><%= inserted %>건 저장, <%= duplicates %>건 중복 제외</p>
  <% if (errors.length) { %>
    <h2>건너뛴 행 (<%= errors.length %>)</h2>
    <ul>
      <% errors.forEach(e => { %>
        <li><%= e.reason %>: <%= JSON.stringify(e.raw) %></li>
      <% }) %>
    </ul>
  <% } %>
  <p><a href="/">대시보드로</a> | <a href="/import">더 붙여넣기</a></p>
</body>
</html>
```

- [ ] **Step 5: Manually verify the full import flow**

Run:

```bash
npm start
```

In another terminal, simulate a paste (tab-separated) end to end:

```bash
curl -s -X POST http://localhost:3000/import/preview \
  --data-urlencode "newSourceName=테스트카드" \
  --data-urlencode "newSourceType=card" \
  --data-urlencode "hasHeader=on" \
  --data-urlencode $'pastedText=날짜\t내용\t금액\n2026.08.01\t스타벅스\t5,000' \
  | grep "미리보기"
```

Expected: output contains `<h1>미리보기 (상위 2행)</h1>`. Then open `http://localhost:3000/import` in a browser, paste a couple of real rows, confirm the mapping dropdowns, submit, and confirm `/` shows the new transaction and total. Stop the server when confirmed.

- [ ] **Step 6: Commit**

```bash
git add server.js views/import-form.ejs views/import-preview.ejs views/import-result.ejs
git commit -m "feat: add paste-import flow with column mapping and dedup"
```

---

### Task 6: README + deployment notes

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: none.

- [ ] **Step 1: Write `README.md`**

```markdown
# 우리집 재무관리

부부가 함께 보는 가계 재무 대시보드. 카드/계좌 거래내역을 엑셀에서 복사해 붙여넣으면
월별로 집계해서 보여준다.

## 로컬 실행

\`\`\`bash
npm install
npm start
\`\`\`

브라우저에서 http://localhost:3000 접속. 데이터는 프로젝트 폴더의 `data.db`에 저장된다.

## 테스트

\`\`\`bash
npm test
\`\`\`

## 배포 (Render 예시)

1. 이 저장소를 GitHub에 올린다.
2. Render 대시보드에서 "New Web Service" → 저장소 연결.
3. Build Command: `npm install`, Start Command: `npm start`.
4. **Disk** 탭에서 영구 디스크를 추가하고 마운트 경로를 예: `/data`로 지정한다.
5. 환경변수 `DB_PATH=/data/data.db`를 추가한다 (재배포해도 데이터가 유지되도록).
6. 배포 후 발급된 URL을 배우자와 공유한다.

## 범위 밖

카테고리 분류, 로그인, 은행/카드사 API 자동 연동은 다루지 않는다.
자세한 배경은 [설계 문서](docs/superpowers/specs/2026-08-26-household-finance-dashboard-design.md) 참고.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with local run and Render deployment steps"
```

---

## Self-Review Notes

- **Spec coverage:** 출처 관리(Task 5 inline form) / 붙여넣기 입력·컬럼 매핑·중복 방지(Task 2, 5) / 월간 대시보드(Task 4) / 배포 문서(Task 6) — 스펙의 모든 섹션에 대응하는 태스크 있음.
- **Placeholder scan:** 없음 — 모든 스텝에 실제 코드 포함.
- **Type consistency:** `applyMapping` 반환 형태(`{rows, errors}`)와 `insertTransactions` 입력 형태(`{date, description, amount, raw_hash}`)가 Task 2 → Task 5에서 일관됨. `getAllTransactions`/`getTransactionsForMonth`의 `source_name` 필드명이 `lib/aggregate.js`와 `views/dashboard.ejs`에서 동일하게 사용됨.
