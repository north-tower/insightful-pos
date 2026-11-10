#!/usr/bin/env node
/**
 * Guard: currency must use formatKES / Money — no drift to Ksh, inline Intl, or mono at large sizes.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'check-money-allowlist.txt');

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return new Set();
  const lines = fs.readFileSync(ALLOWLIST_PATH, 'utf8').split(/\r?\n/);
  return new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const allowlist = loadAllowlist();
const violations = [];

const MONO_LARGE =
  /font-mono[\s\S]{0,120}?(?:text-(?:lg|xl|2xl|3xl|4xl|5xl|6xl|\[[2-9]\dpx\])|text-\[(?:1[89]|[2-9]\d)\d*px\])/;

const MONO_LARGE_REV =
  /(?:text-(?:lg|xl|2xl|3xl|4xl|5xl|6xl|\[[2-9]\dpx\])|text-\[(?:1[89]|[2-9]\d)\d*px\])[\s\S]{0,120}?font-mono/;

function isAllowed(file, line) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const key = `${rel}:${line}`;
  if (allowlist.has(key)) return true;
  if (allowlist.has(rel)) return true;
  if (rel === 'src/lib/formatKES.ts') return true;
  if (rel === 'src/lib/units.ts') return true;
  if (rel === 'src/lib/typedNumberPreview.ts') return true;
  if (rel === 'src/lib/shopFloat.ts') return true;
  return false;
}

function nearCurrencyWindow(text, idx, radius = 60) {
  const slice = text.slice(Math.max(0, idx - radius), idx + radius);
  return /\b(KES|Ksh|KSh|currency)\b/i.test(slice);
}

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (isAllowed(file, lineNo)) return;

    if (/\bKsh\b|\bKSh\b|\bKSH\b/.test(line) && !line.trim().startsWith('//')) {
      violations.push(`${rel}:${lineNo}: visible "Ksh" — use KES`);
    }

    if (
      rel !== 'src/lib/formatKES.ts' &&
      (/\btoFixed\s*\(/.test(line) ||
        /\btoLocaleString\s*\(/.test(line) ||
        /\bIntl\.NumberFormat\b/.test(line))
    ) {
      const idx = line.search(/\btoFixed\s*\(|\btoLocaleString\s*\(|\bIntl\.NumberFormat\b/);
      if (idx >= 0 && nearCurrencyWindow(line, idx)) {
        violations.push(
          `${rel}:${lineNo}: inline number format near currency — use formatKES/Money`,
        );
      }
    }

    if (MONO_LARGE.test(line) || MONO_LARGE_REV.test(line)) {
      violations.push(`${rel}:${lineNo}: font-mono with text-lg or larger`);
    }
  });
}

if (violations.length) {
  console.error('check:money failed:\n');
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error(`\n${violations.length} violation(s). Add exceptions to scripts/check-money-allowlist.txt`);
  process.exit(1);
}

console.log('check:money OK');
