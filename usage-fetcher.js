const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CACHE_FILE = path.join(__dirname, '.usage-cache.json');
const HELPER_SCRIPT = path.join(__dirname, 'fetch-helper.js');

// GUI 앱(.app)으로 더블클릭 실행하면 PATH에 homebrew 경로가 없어
// `node`를 못 찾을 수 있다. 절대경로 후보를 먼저 탐색한다.
function findNode() {
  const candidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    path.join(os.homedir(), '.local', 'bin', 'node'),
  ];
  for (const p of candidates) {
    try { fs.accessSync(p); return p; } catch {}
  }
  try { return execSync('command -v node', { encoding: 'utf-8' }).trim(); } catch {}
  return 'node';
}
const NODE_BIN = findNode();
// helper(및 그 안의 claude)가 도구를 찾을 수 있도록 PATH를 보강한다.
const AUGMENTED_PATH = [
  '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
  path.join(os.homedir(), '.local', 'bin'),
  process.env.PATH || '',
].join(':');

// Save fetched data to cache
function saveCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

// Load cached data
function loadCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Run the fetch-helper.js as a separate Node.js process
// (uses system Node.js, not Electron, so node-pty works without rebuild)
function fetchViaHelper() {
  return new Promise((resolve, reject) => {
    const cmd = `"${NODE_BIN}" "${HELPER_SCRIPT}"`;
    console.log('[usage-fetcher] Running helper script... node=' + NODE_BIN);

    exec(cmd, {
      timeout: 35000,
      cwd: __dirname,
      env: { ...process.env, PATH: AUGMENTED_PATH },
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (stderr) console.log('[usage-fetcher] Helper stderr:', stderr);

      if (error) {
        return reject(new Error('Helper failed: ' + (error.message || 'unknown')));
      }

      try {
        const data = JSON.parse(stdout.trim());
        if (data.session || data.week) {
          resolve(data);
        } else {
          reject(new Error('Helper returned no usage data'));
        }
      } catch (e) {
        reject(new Error('Failed to parse helper output: ' + e.message));
      }
    });
  });
}

// Main fetch function
async function fetchUsage() {
  try {
    console.log('[usage-fetcher] Fetching via helper...');
    const data = await fetchViaHelper();
    console.log('[usage-fetcher] Success:', JSON.stringify(data).slice(0, 200));
    saveCache(data);
    return data;
  } catch (e) {
    console.log('[usage-fetcher] Helper failed:', e.message);
  }

  // Fallback: cached data
  console.log('[usage-fetcher] Falling back to cache...');
  const cached = loadCache();
  if (cached) {
    cached.fromCache = true;
    return cached;
  }

  return null;
}

module.exports = { fetchUsage, saveCache, loadCache };
