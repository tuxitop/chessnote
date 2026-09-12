# Chessnote — Digital Chess Scoresheet

A fast, local-first digital chess scoresheet. Record games move by move,
organize them into (nested) collections, add comments and variations,
import/export standard PGN, and optionally sync across devices via a private
GitHub Gist.

Live demo (GitHub Pages): `https://tuxitop.github.io/chessnote/`

## Features

- **Game recording** — interactive board (chessground + chess.js), rapid move
  input, SAN validation, undo/redo, autoplay, board themes and orientation.
- **Collections** — nested folders with drag & drop, rename, game counters,
  search, and A–Z / Z–A sorting.
- **Annotation** — per-move comments, variations, general notes, analysis
  reports, tags, starring, and puzzle status tracking.
- **PGN** — import single or multi-game PGN files; export any game; full JSON
  backup / restore of the whole library.
- **Puzzles** — dedicated puzzle hub (all / unsolved / solved / failed, plus
  theme grouping) for positions with a custom FEN.
- **Cloud sync (GitHub Gist)** — manual push/pull, lossless smart merge,
  auto-sync on changes (20 s debounce), and periodic background sync.
  Sync is **deletion-aware**: deleted folders/games/moves stay deleted
  (tombstones + last-write-wins by `updatedAt`); see “Sync model” below.
- **Local-first & private** — data lives in `localStorage`; the GitHub token
  and Gist ID never leave your browser except for GitHub API calls.

## Quick start

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev      # → http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run lint     # type-check (tsc --noEmit)
npm run clean    # remove dist/
```

No environment variables are required (see `.env.example`).

## Sync model

Each `Folder` and `Game` carries an `updatedAt` ISO timestamp, bumped on every
local create/rename/move/edit — including move deletions and truncations.

- **Smart Merge** (`src/utils/sync.ts` → `smartMergeFolders`) merges by ID:
  - IDs found only in the cloud but recorded in the local tombstone store
    (`localStorage: chess_notation_deleted_ids`) are treated as *deleted* and
    are not resurrected; they are dropped from the merged result so the next
    push removes them from the Gist.
  - IDs on both sides resolve by **last-write-wins** on `updatedAt`
    (legacy items without timestamps fall back to the old “longer game wins”
    heuristic).
  - A game that exists locally keeps its local folder location (move intent).
- **Upload to Cloud (push)** overwrites the Gist with local data — this is how
  deletions propagate. **Download from Cloud (pull)** overwrites local data
  with the Gist — this discards local deletions.

Recommended delete flow:

1. Delete the folder / game / move(s) normally in the UI.
2. Let auto-sync run (~20 s), or open **Gist Sync → Upload to Cloud**.
3. Don’t press **Download from Cloud** right after deleting.
4. With two devices: sync the device where you deleted first, then the other.

## Project structure

```
src/
  App.tsx                 # state, persistence, background/auto sync
  types.ts                # Folder / Game / MovePly / AnalysisReport
  utils/
    pgn.ts                # PGN import/export, move-tree helpers
    sync.ts               # deletion-aware merge (tombstones + LWW)
  components/
    Sidebar.tsx           # collections, games, puzzle hub
    GameEditor.tsx        # board, scoresheet, annotations, engine
    GistSyncModal.tsx     # token/gist setup, push/pull/merge
    ImportModal.tsx       # PGN import
    HotkeyModal.tsx       # shortcut cheat sheet
```

## Deployment

Pushes to `main` build and deploy via `.github/workflows/deploy.yml`
(GitHub Pages). The Vite `base` is `/chessnote/`, matching the repo name.

## Tech stack

React 19, Vite 6, Tailwind CSS 4, chess.js, Lichess chessground,
lucide-react, motion. No backend — static build + GitHub Gist API for sync.
