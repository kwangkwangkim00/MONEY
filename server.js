const express = require('express');
const path = require('path');
const {
  openDb, getTransactionsForMonth, getAllTransactions,
  listSources, createSource, saveColumnMapping, insertTransactions,
} = require('./db');
const { recentMonthTotals } = require('./lib/aggregate');
const { parseGrid, applyMapping } = require('./lib/parser');

const db = openDb(process.env.DB_PATH || path.join(__dirname, 'data.db'));
const app = express();
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
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

app.get('/import', (req, res) => {
  res.render('import-form', { sources: listSources(db) });
});

app.post('/import/preview', (req, res) => {
  const { sourceId, newSourceName, newSourceType, pastedText, hasHeader } = req.body;
  let resolvedSourceId = Number(sourceId);
  if (!resolvedSourceId && newSourceName) {
    resolvedSourceId = listSources(db).find(s => s.name === newSourceName)?.id
      || createSource(db, newSourceName, newSourceType || 'card');
  }
  const source = listSources(db).find(s => s.id === resolvedSourceId);
  if (!source) {
    return res.status(400).render('error', { message: '출처를 선택하거나 새로 추가해주세요.' });
  }
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
  if (!listSources(db).find(s => s.id === sourceId)) {
    return res.status(400).render('error', { message: '출처를 선택하거나 새로 추가해주세요.' });
  }
  const hasHeader = req.body.hasHeader === 'on';
  const pastedText = req.body.pastedText;

  const mapping = [];
  let i = 0;
  while (req.body[`col${i}`] !== undefined) {
    mapping.push(req.body[`col${i}`]);
    i++;
  }

  if (!mapping.includes('date') || !mapping.includes('amount')) {
    return res.status(400).render('error', {
      message: '열 지정에서 "날짜"와 "금액"을 각각 하나씩 선택해야 저장할 수 있어요. 뒤로 가서 다시 지정해주세요.',
    });
  }

  const grid = parseGrid(pastedText);
  const { rows, errors } = applyMapping(grid, mapping, sourceId, hasHeader);
  const { inserted, duplicates } = insertTransactions(db, sourceId, rows);
  saveColumnMapping(db, sourceId, mapping);

  res.render('import-result', { inserted, duplicates, errors });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));
}

module.exports = { app, db };
