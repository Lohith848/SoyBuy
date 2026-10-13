#!/usr/bin/env node
/**
 * scripts/check-no-literals.mjs
 *
 * Fails (exit 1) if any frontend source file under apps/web/src contains a
 * hard-coded business number, i.e. leaked fake data. Test files are ignored.
 *
 * Flagged patterns (outside test files):
 *   1. a currency symbol followed by a literal number      (₹48500)
 *   2. a grouped number literal                            (48,500 / 1,00,00,000)
 *   3. a number with a business unit suffix                (3.78 Cr, 48500 INR/t)
 *   4. a three-or-more digit number with a tonne suffix    (1450 t, 350t)
 *   5. an array/collection of 5+ numeric literals
 *
 * Every finding is printed with file:line and a code frame; exit code is
 * non-zero so CI blocks the merge.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGET = join(ROOT, 'apps/web/src');
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'];
const SKIP_RE = /(node_modules|[\\/]\.next[\\/]|\.test\.|\.spec\.|__tests__|[\\/]tests?[\\/])/;

const RULES = [
  { name: 'currency symbol followed by a literal number', re: /₹\s*\d/ },
  { name: 'grouped number literal', re: /\b\d{1,3}(?:,\d{2,3})+\b/ },
  // Require a real business magnitude (>=3 digits, or a decimal) before the
  // unit, so labels such as "P10 INR/t" are not false positives.
  { name: 'number with a business unit suffix', re: /(?:\b\d{3,}(?:\.\d+)?|\d+\.\d+)\s*(?:Cr\b|INR\/t\b|INR\/tonne\b|lakh\b|crore\b)/ },
  { name: 'three-or-more digit number with a tonne suffix', re: /\b\d{3,}(?:\.\d+)?\s*t\b/ },
  { name: 'array/collection of 5+ numeric literals', re: /[[(]\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){4,}\s*[\])]/ },
];

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (SKIP_RE.test(p)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXTS.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const findings = [];
for (const file of walk(TARGET)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        findings.push({
          file: relative(ROOT, file),
          line: i + 1,
          rule: rule.name,
          text: line.trim().slice(0, 160),
        });
      }
    }
  });
}

if (findings.length) {
  console.error(`FAILED: ${findings.length} hard-coded literal(s) found in apps/web/src:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}]`);
    console.error(`      ${f.text}`);
  }
  console.error('\nEvery number in the UI must come from an API response.');
  process.exit(1);
}
console.log('PASSED: no hard-coded business literals in apps/web/src.');
