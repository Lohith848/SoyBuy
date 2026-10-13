#!/usr/bin/env node
/**
 * scripts/check-flat-design.mjs
 *
 * Fails (exit 1) if any web source/config contains a non-flat visual style:
 *   - linear-gradient / radial-gradient (incl. Tailwind bg-gradient-*)
 *   - backdrop-filter / backdrop-blur (glassmorphism)
 *   - filter: blur(...) / blur(...)
 *   - box-shadow whose blur radius exceeds MAX_BLUR_PX (default 2)
 *
 * Findings are printed with file:line; exit code is non-zero so CI blocks it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGETS = [join(ROOT, 'apps/web/src'), join(ROOT, 'apps/web/tailwind.config.js'), join(ROOT, 'apps/web/tailwind.config.ts')];
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.scss'];
const SKIP_RE = /(node_modules|[\\/]\.next[\\/])/;
const MAX_BLUR_PX = 2;

const HARD_RULES = [
  { name: 'gradient', re: /(linear-gradient|radial-gradient|conic-gradient|bg-gradient-to-|@apply\s+.*gradient)/ },
  { name: 'backdrop blur / glassmorphism', re: /(backdrop-filter|backdrop-blur|glass-card|glassmorphism)/ },
  { name: 'CSS filter blur', re: /filter\s*:\s*[^;]*\bblur\(|\bblur\(\s*\d/ },
];

// Extract the blur radius from a box-shadow value: the 3rd length token.
function blurRadiusFromShadow(value) {
  const withoutColor = value.replace(/(rgba?|hsla?)\([^)]*\)/gi, '').replace(/#[0-9a-f]{3,8}/gi, '');
  const lengths = [...withoutColor.matchAll(/(-?\d*\.?\d+)px/g)].map((m) => Math.abs(parseFloat(m[1])));
  return lengths.length >= 3 ? lengths[2] : 0;
}

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

const files = new Set();
for (const t of TARGETS) {
  try {
    if (statSync(t).isDirectory()) walk(t).forEach((f) => files.add(f));
    else files.add(t);
  } catch {
    /* missing target is fine */
  }
}

const findings = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of HARD_RULES) {
      if (rule.re.test(line)) {
        findings.push({ file: relative(ROOT, file), line: i + 1, rule: rule.name, text: line.trim().slice(0, 160) });
      }
    }
    if (/box-?shadow/i.test(line)) {
      const match = line.match(/box-?shadow\s*[:=]\s*['"]?([^;'"]+)/i);
      const value = match ? match[1] : line;
      const blur = blurRadiusFromShadow(value);
      if (blur > MAX_BLUR_PX) {
        findings.push({
          file: relative(ROOT, file),
          line: i + 1,
          rule: `box-shadow blur ${blur}px > ${MAX_BLUR_PX}px`,
          text: line.trim().slice(0, 160),
        });
      }
    }
  });
}

if (findings.length) {
  console.error(`FAILED: ${findings.length} non-flat style(s) found:\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}]`);
    console.error(`      ${f.text}`);
  }
  console.error('\nDesign rule: flat solids only — no gradients, glow, blur, or heavy shadows.');
  process.exit(1);
}
console.log('PASSED: flat design — no gradients, blur, or heavy shadows.');
