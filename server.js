const express = require('express');
const path = require('path');
const { openDb, getTransactionsForMonth, getAllTransactions } = require('./db');
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
