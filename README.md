# Goosain Bolt

A **Cocos Creator 3.x** side-scrolling runner: dodge hazards, collect currency, manage health, and reach the finish. Gameplay tuning lives in `assets/scripts/config/GameConfig.ts` so you can iterate without rewriting core logic.

## Requirements

- [Cocos Creator](https://www.cocos.com/en/creator-download) **3.8.8** (match `package.json` → `creator.version` for fewer surprises)
- **Node.js** 18+ (for tooling scripts)

## Getting started

1. Clone the repo and open the project folder in **Cocos Creator**.
2. Open the main scene: `assets/scenes/Main.scene`.
3. Use **Project → Build** when you need a web build (e.g. output to `build/web-mobile-001`).

## Single-file HTML (playable / 5 MiB cap)

After a **Web Mobile** build exists under `build/` (any `web-mobile*` folder with `index.html`):

```bash
npm run pack:single-html
```

This runs [`cocos-creator-single-file-package`](https://www.npmjs.com/package/cocos-creator-single-file-package) via `tools/pack-single-html.mjs`, writes **`build/single-html/playable.html`**, and **fails if the file is larger than 5 MiB** (binary bytes). Override with `PLAYABLE_MAX_MB`, `PLAYABLE_MAX_BYTES`, or `--max-mb` / `--max-bytes`.

- **`--prune-native`** (enabled in the npm script): before packing, removes `.astc` / `.pkm` / `.pvr` when a sibling `.png` exists for the same asset, so the packer does not embed duplicate GPU texture variants. **This edits files inside the chosen build folder** — use a fresh Web Mobile build if you need an untouched output. Skip pruning with `npm run pack:single-html -- --no-prune-native`.
- **`CC_BUILD_DIR`** or **`--build-dir`**: pick a folder if auto-detect (newest `build/web-mobile*`) is wrong.

Staying under the limit: use smaller textures / WebP, shorten audio, strip unused engine features in **Project → Project Settings → Module Config**, and keep the first playable load minimal.

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run pack:single-html` | One self-contained HTML from latest `build/web-mobile*` → `build/single-html/playable.html` (5 MiB max) |
| `npm run fetch:playbox-raw` | Fetch Playbox raw HTML (see `tools/`) |
| `npm run extract:playbox` | Extract embedded data URLs from playable HTML |
| `npm run extract:har` | Extract assets from a HAR file |

Run scripts from the repository root.

## Repository layout (high level)

- `assets/scripts/` — TypeScript gameplay, UI, currency, finish line, pooling, etc.
- `assets/scenes/` — Editor scenes
- `tools/` — Node helpers for playable packing and HTML/HAR utilities
- `_WIP_/` — Work-in-progress notes and checklists (not required to run the game)

## Agentic development

This project was built through **agentic development**: autonomous or semi-autonomous coding agents (LLM-backed tools, editor-integrated agents, and similar workflows) drove much of the work across code, scenes/prefabs, documentation, and tooling. Human authors steer goals, review changes, run tests, and own release decisions. If you fork the project, mentioning agentic / AI-assisted development is appreciated for transparency.
