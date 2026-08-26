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
