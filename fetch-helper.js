#!/usr/bin/env node
// Runs as a SEPARATE Node.js process (not inside Electron).
// Spawns claude in a PTY, sends /usage, parses output, prints JSON to stdout.

const pty = require('node-pty');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

// Locate claude binary automatically
function findClaude() {
  // Check common install locations
  const isWin = os.platform() === 'win32';
  const home = os.homedir();

  const candidates = isWin
    ? [
        path.join(home, '.local', 'bin', 'claude.exe'),
        path.join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
      ]
    : [
        path.join(home, '.local', 'bin', 'claude'),
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
      ];

  for (const p of candidates) {
    try { require('fs').accessSync(p); return p; } catch {}
  }

  // Fallback: ask the system PATH
  try {
    const cmd = isWin ? 'where claude' : 'which claude';
    return execSync(cmd, { encoding: 'utf-8' }).trim().split('\n')[0];
  } catch {}

  throw new Error('Could not find claude binary. Make sure Claude Code CLI is installed.');
}

const CLAUDE_PATH = findClaude();
// Use a temp directory as the trusted CWD (any directory works for /usage)
const TRUSTED_DIR = os.tmpdir();

function cleanOutput(raw) {
  let s = raw;
  // Strip OSC sequences (title sets etc)
  s = s.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
  // Replace cursor-right movements with space
  s = s.replace(/\x1b\[\d*C/g, ' ');
  // Replace cursor positioning (row;col) with newline
  s = s.replace(/\x1b\[\d+;\d+H/g, '\n');
  // Strip all remaining ANSI/VT escape sequences
  s = s.replace(/\x1b\[[^A-Za-z]*[A-Za-z]/g, '');
  s = s.replace(/\x1b[=>]/g, '');
  s = s.replace(/\x1b[()][0-9A-Za-z]/g, '');
  // Strip carriage returns (keep newlines)
  s = s.replace(/\r/g, '\n');
  // Clean up block/box-drawing characters (progress bars)
  s = s.replace(/[█▉▊▋▌▍▎▏░▒▓▐▛▜▝▘▗▖▞▟■□▪▫●○◆◇]/g, '');
  // Replace tabs with spaces
  s = s.replace(/\t/g, ' ');
  // Collapse multiple spaces into single
  s = s.replace(/ {2,}/g, ' ');
  // Clean lines
  s = s.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
  return s;
}

function cleanResetTime(raw) {
  if (!raw) return raw;
  const s = raw.trim();

  // Parse time: "10:50pm" or "1am" or "12:59am"
  function parseTime(timeStr) {
    const m12 = timeStr.match(/(\d{1,2})(?::(\d{2}))?(am|pm)/i);
    if (!m12) return null;
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? m12[2] : '00';
    const ampm = m12[3].toLowerCase();
    const period = ampm === 'am' ? '오전' : '오후';
    // Convert: 12am → 0, 12pm → 12, etc.
    if (ampm === 'am' && h === 12) h = 0;
    if (ampm === 'pm' && h !== 12) h += 12;
    // Back to 12h display
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${period} ${displayH}:${min}`;
  }

  // Pattern A: just time + timezone → "오늘 오전/오후 H:MM"
  // e.g. "10:50pm(Asia/Seoul)" or "10:50pm (Asia/Seoul)"
  const justTime = s.match(/^(\d{1,2}(?::\d{2})?(?:am|pm))\s*\([A-Za-z\/]+\)$/i);
  if (justTime) {
    const t = parseTime(justTime[1]);
    return t ? `오늘 ${t}` : s;
  }

  // Pattern B: month + day + time → "N월 D일 오전/오후 H:MM"
  // e.g. "Jun30at1am(Asia/Seoul)" or "Jun 30 at 1am (Asia/Seoul)"
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const withDate = s.match(/([A-Za-z]{3})\s*(\d{1,2})\s*(?:at\s*)?(\d{1,2}(?::\d{2})?(?:am|pm))/i);
  if (withDate) {
    const mon = MONTHS[withDate[1].toLowerCase()];
    const day = withDate[2];
    const t = parseTime(withDate[3]);
    if (mon && t) return `${mon}월 ${day}일 ${t}`;
  }

  // Pattern C: number day + time (month lost to PTY corruption)
  // e.g. "30at1am(Asia/Seoul)" or "30 a 12:59am"
  const dayTime = s.match(/^(\d{1,2})\s*(?:at\s*|[a-z]\s+)?(\d{1,2}(?::\d{2})?(?:am|pm))/i);
  if (dayTime) {
    const day = dayTime[1];
    const t = parseTime(dayTime[2]);
    if (t) return `${day}일 ${t}`;
  }

  return s;
}

function parseUsage(text) {
  const result = {
    session: null,
    week: null,
    weekSonnet: null,
    extra: null,
    timestamp: Date.now(),
  };

  const lines = text.split('\n');

  // Extract percent + resetTime starting from a given line index
  function extractFrom(startIdx) {
    let percent = null;
    let resetTime = null;
    for (let i = startIdx; i < Math.min(startIdx + 7, lines.length); i++) {
      const line = lines[i];
      // Stop if we hit another major section header
      if (i > startIdx && /current\s*(session|week)/i.test(line)) break;
      if (percent === null) {
        const m = line.match(/(\d+)\s*%\s*used/i);
        if (m) { percent = parseInt(m[1], 10); continue; }
      }
        if (percent !== null && resetTime === null) {
        const m = line.match(/Reset[s]?\s*(.+\([A-Za-z\/]+\))/i);
        if (m) { resetTime = cleanResetTime(m[1]); break; }
      }
    }
    return percent !== null ? { percent, resetTime } : null;
  }

  // Find first line matching any of the patterns, with optional exclusions
  function findLineIdx(includePatterns, excludePatterns = []) {
    return lines.findIndex(l =>
      includePatterns.some(p => p.test(l)) &&
      !excludePatterns.some(p => p.test(l))
    );
  }

  // Session
  const sessionIdx = findLineIdx([/current\s*session/i]);
  if (sessionIdx !== -1) result.session = extractFrom(sessionIdx);

  // Week (all models) — "Current week" without "sonnet"
  const weekIdx = findLineIdx([/current\s*week/i], [/sonnet/i]);
  if (weekIdx !== -1) result.week = extractFrom(weekIdx);

  // Week (Sonnet only) — "Current week" with "sonnet", or standalone "Sonnet only"
  const sonnetIdx = findLineIdx([/current\s*week.*sonnet/i, /sonnet\s+only/i]);
  if (sonnetIdx !== -1) result.weekSonnet = extractFrom(sonnetIdx);

  // Extra usage
  const extraIdx = findLineIdx([/extra\s+usage/i]);
  if (extraIdx !== -1) result.extra = extractFrom(extraIdx);

  // Spend tracking for extra
  const spendMatch = text.match(/\$(\d+\.?\d*)\s*\/\s*\$(\d+\.?\d*)\s*spent/i);
  if (result.extra && spendMatch) {
    result.extra.spent = parseFloat(spendMatch[1]);
    result.extra.limit = parseFloat(spendMatch[2]);
  }

  return result;
}

function fetchUsage() {
  return new Promise((resolve, reject) => {
    let output = '';
    let exited = false;

    const shell = pty.spawn(CLAUDE_PATH, [
      '--dangerously-skip-permissions'
    ], {
      name: 'xterm-256color',
      cols: 120,
      rows: 80,
      cwd: TRUSTED_DIR,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });

    shell.onData((data) => {
      output += data;
    });

    // Wait for Claude v2+ to fully start the TUI, then send /usage with Enter in one shot
    setTimeout(() => { shell.write('/usage\r'); }, 8000);

    setTimeout(() => {
      shell.write('/exit\r');
    }, 18000);

    setTimeout(() => {
      if (!exited) {
        exited = true;
        try { shell.kill(); } catch (e) {}
        const cleaned = cleanOutput(output);
        try { require('fs').writeFileSync('/tmp/usage-debug.txt', cleaned); } catch (e) {}
        const data = parseUsage(cleaned);
        resolve(data);
      }
    }, 22000);

    shell.onExit(() => {
      if (!exited) {
        exited = true;
        const cleaned = cleanOutput(output);
        const data = parseUsage(cleaned);
        resolve(data);
      }
    });
  });
}

fetchUsage()
  .then((data) => {
    process.stdout.write(JSON.stringify(data));
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write('Error: ' + err.message);
    process.exit(1);
  });
