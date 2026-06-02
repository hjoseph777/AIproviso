#!/usr/bin/env node
/**
 * validate-sql.mjs
 * Static SQL validation for workflow-engine/server.mjs.
 * Parses every INSERT statement and asserts column count == value count.
 * No DB connection required — runs in CI before docker build.
 *
 * Usage:  node workflow-engine/validate-sql.mjs
 * Exit 0 = all INSERT statements balanced
 * Exit 1 = at least one column/value mismatch found
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, 'server.mjs'), 'utf8');

/**
 * Split a comma-separated SQL token list respecting nested parentheses.
 * Correctly handles: now(), 'scheduled', $7::jsonb, now(),now()
 */
function splitSqlTokens(raw) {
  const tokens = [];
  let depth = 0, cur = '';
  for (const ch of raw) {
    if      (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) { tokens.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  if (cur.trim()) tokens.push(cur.trim());
  return tokens.filter(Boolean);
}

/**
 * Find all INSERT INTO ... ( cols ) VALUES ( vals ) blocks.
 * Uses a character-by-character parser to correctly handle nested parens.
 */
function findInserts(source) {
  const results = [];
  // Match each INSERT start
  const re = /INSERT\s+INTO\s+(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const table   = m[1];
    const lineNo  = source.slice(0, m.index).split('\n').length;
    let   pos     = m.index + m[0].length;
    // Extract column list (balanced parens starting just after the '(' already consumed)
    let depth = 1, colStr = '';
    while (pos < source.length && depth > 0) {
      const ch = source[pos++];
      if      (ch === '(') { depth++; colStr += ch; }
      else if (ch === ')') { depth--; if (depth > 0) colStr += ch; }
      else    { colStr += ch; }
    }
    // Find VALUES (
    const valuesMatch = /VALUES\s*\(/i.exec(source.slice(pos));
    if (!valuesMatch) continue;
    pos += valuesMatch.index + valuesMatch[0].length;
    // Extract values list (balanced parens)
    depth = 1;
    let valStr = '';
    while (pos < source.length && depth > 0) {
      const ch = source[pos++];
      if      (ch === '(') { depth++; valStr += ch; }
      else if (ch === ')') { depth--; if (depth > 0) valStr += ch; }
      else    { valStr += ch; }
    }
    const cols = splitSqlTokens(colStr);
    const vals = splitSqlTokens(valStr);
    results.push({ table, lineNo, cols, vals });
  }
  return results;
}

const inserts = findInserts(src);
const issues  = [];
const ok      = [];

for (const { table, lineNo, cols, vals } of inserts) {
  if (cols.length !== vals.length) {
    issues.push({ table, lineNo, cols, vals });
  } else {
    ok.push({ table, lineNo, count: cols.length });
  }
}

// Report
console.log('\n=== workflow-engine SQL validation ===\n');

if (ok.length) {
  console.log('✓ Balanced INSERTs:');
  ok.forEach(r => console.log(`  L${r.lineNo} INSERT INTO ${r.table}: ${r.count} cols = ${r.count} vals`));
}

if (issues.length) {
  console.log('\n✗ MISMATCHED INSERTs (will cause Postgres error 42601):');
  issues.forEach(r => {
    console.log(`\n  L${r.lineNo} INSERT INTO ${r.table}: ${r.cols.length} cols vs ${r.vals.length} vals`);
    const maxLen = Math.max(r.cols.length, r.vals.length);
    for (let i = 0; i < maxLen; i++) {
      const col = r.cols[i] || '(missing)';
      const val = r.vals[i] || '(missing)';
      const mark = (col === '(missing)' || val === '(missing)') ? ' ← MISMATCH' : '';
      console.log(`    [${i}] ${col.padEnd(35)} ${val}${mark}`);
    }
  });
  console.log('\nFix: add the missing $N to the VALUES clause AND the');
  console.log('     corresponding value to the params array. Then rebuild:\n');
  console.log('     docker compose build workflow-engine');
  console.log('     docker compose up -d workflow-engine\n');
  process.exit(1);
}

console.log('\n✓ All INSERT statements balanced — safe to deploy.\n');
