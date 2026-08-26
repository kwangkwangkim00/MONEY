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
