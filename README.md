# Claude Code Usage Overlay

> **By [Pears Research Services](mailto:pearsresearchservices@outlook.com)** · 한글화 + macOS 대응 포크 by [Joo2n](https://github.com/Joo2n)

**Always-on-top desktop widget that shows your Claude Code usage limits in real-time.**

![Claude Code Usage Overlay](screenshot.png)

---

## 🇰🇷 한글판 안내 (이 포크에 대하여)

이 레포는 원작([MattPears1/claude-code-usage-overlay](https://github.com/MattPears1/claude-code-usage-overlay))을 **한글화하고 macOS에서 동작하도록 손본 개인 포크**입니다.

### 변경 사항
- **전체 UI 한글화** — `현재 세션`, `이번 주 (전체 모델)`, `Sonnet 전용`, `추가 사용량`, `라이트/다크`, `업데이트` 등
- **리셋 시각 한글 표기** — `오늘 오전 1:40`, `6월 30일 오후 3:00` 형식 (`fetch-helper.js`의 `cleanResetTime`)
- **"초기화/Resets" 라벨 제거** — 리셋 시각만 깔끔하게 표시
- **데이터 없는 섹션 자동 숨김** — `Sonnet 전용`·`추가 사용량`은 `/usage` 출력에 해당 데이터가 있을 때만 표시. 없으면 자동으로 숨겨지고, 한도 구조가 바뀌면 알아서 다시 나타남 (`renderer/app.js`)
- **폴링 주기 30초** — fetch가 ~22초 걸려서 10초 → 30초로 조정 (`main.js`)
- **helper 타임아웃 35초** (`usage-fetcher.js`)
- **`package.json`에 `allowScripts` 추가** — `electron`·`node-pty` 네이티브 빌드 허용 (npm 보안 정책 대응)

### 다시 설치 / 세팅하기 (macOS)

코드만 GitHub에 올라가 있고 `node_modules`(약 313MB)는 포함되지 않으므로, 받은 뒤 `npm install`이 필요합니다.

```bash
gh repo clone Joo2n/claude-code-usage-overlay
cd claude-code-usage-overlay
npm install      # electron + node-pty 네이티브 빌드 (Xcode CLT 필요: xcode-select --install)
npm start        # 오버레이 실행
```

> **참고:** 보관은 GitHub로 충분하지만 **실행하려면 로컬에 clone + `npm install`이 필요**합니다(Electron 데스크톱 앱이라 의존성이 있어야 함). 로컬 폴더는 지워도 되고, 쓸 때 위 명령으로 다시 받으면 됩니다.

> **첫 실행 시:** Claude Code CLI가 설치·로그인되어 있어야 하며(`claude --version`), 첫 데이터 fetch는 ~22초 걸립니다.

### 독(Dock)에 고정하는 앱(.app)으로 만들기 (macOS)

`npm start`나 런타임 아이콘 더블클릭 대신, **독에 고정하고 더블클릭으로 여는 일반 앱**으로 빌드할 수 있습니다.

```bash
npm run build:mac        # dist-app/Claude Usage-darwin-arm64/Claude Usage.app 생성
cp -R "dist-app/Claude Usage-darwin-arm64/Claude Usage.app" ~/Applications/
open ~/Applications/"Claude Usage.app"
```

- 빌드 후 `~/Applications/Claude Usage.app`을 더블클릭하면 오버레이가 바로 뜹니다.
- **독 고정:** 실행 중일 때 독 아이콘 우클릭 → 옵션 → "Dock에 유지".
- 처음 한 번 *"확인되지 않은 개발자"* 경고가 뜨면 우클릭 → 열기로 허용하세요(서명/공증 안 함).
- **`node_modules/.../Electron.app` 아이콘은 직접 실행하지 마세요** — 그건 빈 런타임이라 Electron welcome 화면만 뜹니다.

> **GUI 앱 동작 메모:** `.app`을 Finder/독에서 실행하면 PATH가 최소화되어 `node`·`claude`를 못 찾을 수 있습니다. 이 포크의 `usage-fetcher.js`는 `node` 절대경로를 탐색하고 PATH를 보강하도록 수정되어 GUI 실행에서도 데이터 fetch가 정상 동작합니다. 또한 `fetch-helper.js`가 별도 `node` 프로세스로 실행되므로 패키징은 반드시 **`--no-asar`**(빌드 스크립트에 포함됨)로 해야 합니다.

Stop interrupting your workflow to check `/usage` — this overlay sits on your desktop and shows your session and weekly limits at a glance.

Works with **Claude Max**, **Claude Pro**, and **Claude Team** subscriptions.

---

## What It Shows

| Metric | Description |
|--------|-------------|
| **Current Session** | Your 5-hour rolling session usage with reset time |
| **Weekly (All Models)** | Combined usage across all models for the week |
| **Weekly (Sonnet Only)** | Sonnet-specific weekly usage (shown if applicable) |
| **Extra Usage** | Spend tracking against your configured limit (shown if enabled) |

Bars turn **red and pulse** when usage hits 90%+, so you'll never get caught off guard.

---

## Features

- **Always on top** — floats above all windows, even the taskbar
- **Draggable** — click and drag anywhere to reposition
- **Auto-refresh** — polls your usage every ~30 seconds (fetches every 10s with overlap protection)
- **Manual refresh** — click the refresh button or right-click the overlay
- **System tray** — lives in your tray with opacity controls and quick actions
- **Light / Dark mode** — cyberpunk light theme (default) or dark theme, toggle at the top
- **Mini mode** — click any usage bar to collapse into a single compact bar showing just that metric; click the label to cycle through sections
- **Dot mode** — minimize to a tiny draggable dot; changes color based on usage severity (normal/danger/critical). The dot stays pinned to its position — expanding and collapsing won't move it
- **Position memory** — remembers where you placed it between sessions
- **Cache fallback** — shows last known data if a fetch fails

---

## Requirements

- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** — installed and authenticated (you must have run `claude` at least once and logged in)
- **[Node.js](https://nodejs.org/)** — v18 or later
- **Windows 11** (macOS/Linux support planned)

> **Note:** This overlay reads your usage by running Claude Code's `/usage` command via a pseudo-terminal. It uses your existing Claude Code authentication — no API keys or tokens needed.

---

## Quick Start (Windows)

### Option 1: Double-click

1. Clone or download this repository
2. Double-click **`install.bat`** (one-time setup)
3. Double-click **`start.bat`** to launch

### Option 2: Command line

```bash
git clone https://github.com/YOUR_USERNAME/claude-code-usage-overlay.git
cd claude-code-usage-overlay
npm install
npm start
```

---

## How It Works

```
Electron Overlay (UI)
    │
    ├── main.js          → Creates transparent, frameless, always-on-top window
    ├── usage-fetcher.js  → Spawns fetch-helper as a separate Node.js process
    └── fetch-helper.js   → Uses node-pty to run `claude /usage` in a PTY
                             Parses the TUI output for percentages and reset times
                             Returns JSON to the Electron main process
```

The overlay spawns a hidden Claude Code session every ~30 seconds, sends `/usage`, captures the terminal output, parses out the usage percentages and reset times, then displays them in the overlay. The Claude session is immediately closed after each fetch.

### Why a PTY?

Claude Code's `/usage` is a TUI-only command — it can't be accessed via `claude -p` or the API. The only way to get the data programmatically is to interact with the terminal UI directly. `node-pty` creates a pseudo-terminal that Claude Code sees as a real terminal, allowing us to send commands and capture the rendered output.

---

## Usage Tips

| Action | How |
|--------|-----|
| **Move the overlay** | Click and drag anywhere on the widget |
| **Refresh manually** | Click the **&#x21bb;** button, or **right-click** anywhere |
| **Toggle theme** | Click the **LIGHT/DARK** toggle at the top |
| **Change opacity** | Right-click the **system tray icon** → Opacity |
| **Mini mode** | Click any **usage bar** (e.g. Session, Week) to minimize and show just that bar; click the **label** to cycle sections |
| **Dot mode** | Click the **blue dot** (top-left) to minimize to a tiny dot |
| **Expand from mini/dot** | Click the bar area, the **expand button**, or **right-click** |
| **Hide temporarily** | Close the window (click X or tray) — it hides to tray |
| **Show again** | Click the **tray icon** |
| **Quit** | Right-click **tray icon** → Quit |

---

## Troubleshooting

### "Could not find claude binary"

Make sure Claude Code CLI is installed and on your PATH:

```bash
claude --version
```

If installed but not found, the overlay checks these locations automatically:
- `~/.local/bin/claude` (or `.exe` on Windows)
- `~/AppData/Local/Programs/claude/claude.exe` (Windows)
- `/usr/local/bin/claude` (macOS/Linux)
- `/opt/homebrew/bin/claude` (macOS Homebrew)
- System PATH via `where`/`which`

### "Failed to fetch" / shows cached data

- The first fetch takes ~20 seconds (Claude Code needs to start up)
- If Claude Code is busy in another terminal, the fetch may time out — it will retry shortly
- Check that you're authenticated: run `claude` in a terminal and verify it starts

### Overlay not visible

- Check your system tray — click the orange circle icon to show it
- The overlay may be positioned off-screen — delete `.overlay-position.json` and restart

### node-pty build errors on install

`node-pty` is a native module and needs a C++ compiler:
- **Windows**: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (select "Desktop development with C++")
- **macOS**: `xcode-select --install`
- **Linux**: `sudo apt install build-essential`

---

## Project Structure

```
claude-code-usage-overlay/
├── main.js              # Electron main process (window, tray, IPC)
├── preload.js           # Context bridge for secure IPC
├── fetch-helper.js      # PTY-based usage fetcher (runs as separate process)
├── usage-fetcher.js     # Wrapper that calls fetch-helper via child_process
├── renderer/
│   ├── index.html       # Overlay UI structure
│   ├── styles.css       # Cyberpunk light + dark theme styles
│   └── app.js           # UI logic, theme toggle, drag handling
├── start.bat            # Windows launcher (auto-installs deps)
├── install.bat          # Windows one-time installer
├── package.json
├── LICENSE
└── README.md
```

---

## Configuration

The overlay auto-detects your Claude Code installation. No configuration needed.

If you want to customize the poll interval, edit `main.js`:

```javascript
const POLL_INTERVAL = 10 * 1000; // Change to desired interval in ms (default: 10s)
```

---

## Contributing

Contributions welcome! Some ideas:

- [ ] macOS / Linux support and testing
- [ ] Configurable poll interval via tray menu
- [ ] Notification when approaching limits
- [ ] Historical usage tracking / graphs
- [ ] Auto-start on system boot
---

## Contact

Created by **Pears Research Services**

For questions, suggestions, or support: **pearsresearchservices@outlook.com**

---

## License

MIT
