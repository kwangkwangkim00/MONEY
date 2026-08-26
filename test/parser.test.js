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
