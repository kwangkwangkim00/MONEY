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
