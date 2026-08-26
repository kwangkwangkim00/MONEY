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
