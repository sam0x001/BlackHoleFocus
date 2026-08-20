<p align="center">
  <img src="build/icon.ico" alt="BlackHole Focus" width="128" height="128" />
</p>

<h1 align="center">BlackHole Focus <i>V1.1</i></h1>

<p align="center">
  Personal focus tracker for Windows<br/>
  Electron · React · TypeScript · Tailwind
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-blue" alt="Windows" />
  <img src="https://img.shields.io/badge/Electron-33-47848F" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6" alt="TypeScript" />
</p>

---

## What is this?

**BlackHole Focus** is a desktop focus app. You start timed work sessions by category, track how long you focused, manage a simple task list, switch visual themes, and export history to Excel.

All data stays on your machine. No account. No server.

**Important Note: Make sure you've a backup of data folder before install any update. You can find the data folder's path on settings.**

---

## Features

- **Stopwatch** — counts up until you end the session  
- **Countdown** — presets (15 / 25 / 45 / 60 min) or custom minutes; beeps at zero  
- **Categories** — Add or remove categories in settings with arbitrary color
- **Tasks** — add, complete, delete during Focus Mode  
- **Themes** — Void, Pulse, Neon (optional background image per theme)  
- **Analytics** — sessions grouped by day
- **Excel export** — date, category, duration. Included 2 modes: Daily Sumary & Detailed Sessions 
- **Collapsible sidebar**  
- **Local persistence** — JSON files on disk via Electron  
- **Range Statics** — Total focused time, Mean/day, Std deviation, Variance
- **History** — Check sessions within a specific date range
- **Chart** — Provides a chart of focus time in the current month

---

## Project layout

```
blackhole-focus/
├── build/                 # Windows icon (icon.ico)
├── electron/
│   ├── main.js            # Window + IPC + file storage
│   └── preload.js
├── public/
├── src/
│   ├── components/        # Sidebar, Background, TitleBar, …
│   ├── pages/             # Dashboard, FocusMode, Analytics, Settings
│   ├── store/             # Zustand state
│   ├── db/                # Calls Electron IPC for read/write
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── images/                # Optional assets
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.cjs
├── tsconfig.json
├── tsconfig.node.json
└── README.md
```

Created at runtime (not committed):

- `data/` — sessions, categories, tasks, settings (dev)  
- `dist/` — Vite output  
- `dist-electron/` — Windows build output  
- `node_modules/`  

---

## Requirements

- Node.js **18+** (20 recommended)  
- npm  
- Windows 10/11 (for the packaged app)  

```bash
node -v
npm -v
```

---

## Install & run (development)

```bash
git clone https://github.com/sam0x001/BlackHoleFocus
cd BlackHoleFocus
npm install
npm run dev
```

This starts Vite and opens the **Electron** window.

> Use the Electron window, not only the browser at `localhost:5173`.  
> Saving data depends on Electron’s main process.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Develop (Vite + Electron) |
| `npm run build` | Production build + Windows installer / unpacked exe |
| `npm run preview` | Preview Vite build in the browser (no Electron storage) |

---

## Build (Windows)

1. Put a multi-size icon at:

```text
build/icon.ico
```

   (16, 32, 48, 256 sizes recommended)

2. Build:

```bash
npm run build
```

3. Outputs:

| Path | Use |
|------|-----|
| `dist-electron/*Setup*.exe` | Installer — share this with others |
| `dist-electron/win-unpacked/*.exe` | Unpacked app for local testing |

---

## Data location

| Mode | Path |
|------|------|
| Development | `./data/` in the project folder |
| Production | `%APPDATA%\BlackHoleFocus\data\` |

Files inside `data/`:

| File | Content |
|------|---------|
| `sessions.json` | Focus sessions |
| `categories.json` | Categories |
| `tasks.json` | Tasks |
| `settings.json` | Theme, backgrounds, timer mode, sidebar |

---

## How to use

1. **Dashboard** — pick Stopwatch or Countdown, then start a category  
2. **Focus Mode** — timer, pause/resume/end, tasks on the side  
3. **Analytics** — history + Export Excel  
4. **Settings** — theme, per-theme backgrounds, categories  

Drag the top bar to move the window. Use **Hide** / **Menu** for the sidebar.

---

## Share with others

Send the **Setup** `.exe` from `dist-electron/`.  
They do not need Node.js or this repository.

Windows may show SmartScreen for unsigned apps → *More info* → *Run anyway*.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Data not saving | Use Electron window (`npm run dev`), not browser-only |
| Icon missing on exe | Valid `build/icon.ico` (256*256), delete `dist-electron`, rebuild |
| Stuck on Loading | Reinstall deps: delete `node_modules`, run `npm install` |
| Setup has no data after install | Fully install; data goes under `%APPDATA%\BlackHoleFocus\data\` |

---

## Tech stack

- Electron  
- React 18 + TypeScript  
- Vite  
- Tailwind CSS  
- Zustand  
- ExcelJS  

---

## License

MIT
