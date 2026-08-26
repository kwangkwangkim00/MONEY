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
