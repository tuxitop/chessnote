import { Folder, Game } from '../types';

const TOMBSTONE_KEY = 'chess_notation_deleted_ids';
const LAST_SYNC_ISO_KEY = 'gist_sync_last_time_iso';

export interface Tombstones {
  folders: Record<string, number>; // id -> deletedAt epoch ms
  games: Record<string, number>;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}

export function stampNow(): string {
  return new Date().toISOString();
}

export function getTombstones(): Tombstones {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return { folders: {}, games: {} };
    const parsed = JSON.parse(raw);
    return {
      folders: parsed.folders || {},
      games: parsed.games || {},
    };
  } catch {
    return { folders: {}, games: {} };
  }
}

export function saveTombstones(t: Tombstones) {
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(t));
}

export function recordFolderDeletion(ids: string[]) {
  const t = getTombstones();
  const ts = nowMs();
  ids.forEach((id) => {
    t.folders[id] = ts;
  });
  saveTombstones(t);
}

export function recordGameDeletion(ids: string[]) {
  const t = getTombstones();
  const ts = nowMs();
  ids.forEach((id) => {
    t.games[id] = ts;
  });
  saveTombstones(t);
}

export function getLastSyncMs(): number {
  const iso = localStorage.getItem(LAST_SYNC_ISO_KEY);
  if (iso) {
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms)) return ms;
  }
  // Fallback: no recorded sync -> treat as 0 so tombstones always win
  // (prevents resurrection on first-ever merge after a delete).
  return 0;
}

export function setLastSyncNow() {
  const iso = nowIso();
  localStorage.setItem(LAST_SYNC_ISO_KEY, iso);
  localStorage.setItem('gist_sync_last_time', new Date().toLocaleString());
}

/** Heuristic used previously for legacy items without updatedAt. */
function legacyScore(g: Game): number {
  return (
    (g.moves?.length || 0) +
    (g.analysisReports?.length || 0) * 5 +
    (g.notes?.length || 0) * 0.1
  );
}

/**
 * Pick winning version of a game present on both sides.
 * Prefers explicit updatedAt (last-write-wins) so that move deletions,
 * comment edits, renames etc. propagate. Falls back to legacy
 * length-heuristic only when neither side has a timestamp.
 */
export function pickWinningGame(localGame: Game, cloudGame: Game): Game {
  const l = localGame.updatedAt ? Date.parse(localGame.updatedAt) : NaN;
  const c = cloudGame.updatedAt ? Date.parse(cloudGame.updatedAt) : NaN;
  const lValid = !Number.isNaN(l);
  const cValid = !Number.isNaN(c);
  if (lValid || cValid) {
    if (lValid && !cValid) return localGame;
    if (cValid && !lValid) return cloudGame;
    // Both valid: newest wins; tie -> local (current device intent).
    return l >= c ? localGame : cloudGame;
  }
  return legacyScore(localGame) >= legacyScore(cloudGame) ? localGame : cloudGame;
}

export function pickWinningFolderName(localFolder: Folder, cloudFolder: Folder): { name: string; parentId: string | null; updatedAt?: string } {
  const l = localFolder.updatedAt ? Date.parse(localFolder.updatedAt) : NaN;
  const c = cloudFolder.updatedAt ? Date.parse(cloudFolder.updatedAt) : NaN;
  const lValid = !Number.isNaN(l);
  const cValid = !Number.isNaN(c);
  if (lValid || cValid) {
    if (lValid && !cValid) return { name: localFolder.name, parentId: localFolder.parentId ?? null, updatedAt: localFolder.updatedAt };
    if (cValid && !lValid) return { name: cloudFolder.name, parentId: cloudFolder.parentId ?? null, updatedAt: cloudFolder.updatedAt };
    if (l >= c) return { name: localFolder.name, parentId: localFolder.parentId ?? null, updatedAt: localFolder.updatedAt };
    return { name: cloudFolder.name, parentId: cloudFolder.parentId ?? null, updatedAt: cloudFolder.updatedAt };
  }
  // Legacy fallback: prefer local (previous behaviour).
  return {
    name: localFolder.name || cloudFolder.name,
    parentId: localFolder.parentId !== undefined ? localFolder.parentId ?? null : cloudFolder.parentId ?? null,
    updatedAt: localFolder.updatedAt ?? cloudFolder.updatedAt,
  };
}

/**
 * Deletion-aware bidirectional merge.
 *
 * Rules:
 * - IDs present only in cloud but recorded in local tombstones are treated
 *   as "deleted locally" and are NOT resurrected. They are also dropped from
 *   the merged result so the next push deletes them from the Gist.
 * - IDs present only locally are new -> kept.
 * - IDs on both sides -> LWW by updatedAt (moves/folders/names included).
 * - Tombstones older than the last successful sync AND absent from cloud
 *   are garbage-collected by the caller via pruneTombstones().
 */
export function smartMergeFolders(localFolders: Folder[], cloudFolders: Folder[]): Folder[] {
  const tombstones = getTombstones();

  const localFoldersMap = new Map<string, Folder>();
  localFolders.forEach((f) => localFoldersMap.set(f.id, f));
  const cloudFoldersMap = new Map<string, Folder>();
  cloudFolders.forEach((f) => cloudFoldersMap.set(f.id, f));

  // Index games by id on each side.
  const localGameFolderMap = new Map<string, string>();
  const localGameMap = new Map<string, Game>();
  localFolders.forEach((folder) => {
    folder.games?.forEach((game) => {
      localGameFolderMap.set(game.id, folder.id);
      localGameMap.set(game.id, game);
    });
  });
  const cloudGameFolderMap = new Map<string, string>();
  const cloudGameMap = new Map<string, Game>();
  cloudFolders.forEach((folder) => {
    folder.games?.forEach((game) => {
      cloudGameFolderMap.set(game.id, folder.id);
      cloudGameMap.set(game.id, game);
    });
  });

  // Merge games with tombstone awareness.
  const mergedGamesMap = new Map<string, { game: Game; folderId: string }>();
  const allGameIds = new Set<string>([...localGameMap.keys(), ...cloudGameMap.keys()]);
  allGameIds.forEach((gameId) => {
    const localGame = localGameMap.get(gameId) || null;
    const cloudGame = cloudGameMap.get(gameId) || null;

    if (!localGame && cloudGame) {
      // Only in cloud: resurrect UNLESS locally deleted.
      if (tombstones.games[gameId] !== undefined) return;
      mergedGamesMap.set(gameId, { game: cloudGame, folderId: cloudGameFolderMap.get(gameId)! });
      return;
    }
    if (localGame && !cloudGame) {
      mergedGamesMap.set(gameId, { game: localGame, folderId: localGameFolderMap.get(gameId)! });
      return;
    }
    if (localGame && cloudGame) {
      const winner = pickWinningGame(localGame, cloudGame);
      // Local location wins when the game exists locally (move semantics);
      // otherwise keep cloud location (new remote game).
      const finalFolderId = localGameFolderMap.has(gameId)
        ? localGameFolderMap.get(gameId)!
        : cloudGameFolderMap.get(gameId)!;
      mergedGamesMap.set(gameId, { game: winner, folderId: finalFolderId });
    }
  });

  // Merge folders with tombstone awareness.
  const allFolderIds = new Set<string>([...localFoldersMap.keys(), ...cloudFoldersMap.keys()]);
  const mergedFolders: Folder[] = [];
  allFolderIds.forEach((folderId) => {
    const localFolder = localFoldersMap.get(folderId) || null;
    const cloudFolder = cloudFoldersMap.get(folderId) || null;

    if (!localFolder && cloudFolder) {
      // Only in cloud: resurrect UNLESS locally deleted.
      if (tombstones.folders[folderId] !== undefined) return;
    }
    if (localFolder && !cloudFolder) {
      const folderGames: Game[] = [];
      mergedGamesMap.forEach((val) => {
        if (val.folderId === folderId) folderGames.push(val.game);
      });
      mergedFolders.push({ ...localFolder, games: folderGames });
      return;
    }
    if (!localFolder && cloudFolder) {
      const folderGames: Game[] = [];
      mergedGamesMap.forEach((val) => {
        if (val.folderId === folderId) folderGames.push(val.game);
      });
      mergedFolders.push({ ...cloudFolder, games: folderGames });
      return;
    }
    if (localFolder && cloudFolder) {
      const folderGames: Game[] = [];
      mergedGamesMap.forEach((val) => {
        if (val.folderId === folderId) folderGames.push(val.game);
      });
      const winner = pickWinningFolderName(localFolder, cloudFolder);
      mergedFolders.push({
        ...localFolder,
        name: winner.name,
        parentId: winner.parentId,
        updatedAt: winner.updatedAt ?? localFolder.updatedAt ?? cloudFolder.updatedAt,
        games: folderGames,
      });
    }
  });

  return mergedFolders;
}

/**
 * Remove tombstones that have been fully propagated (id absent from both
 * local and cloud after a successful sync). Keeps storage bounded.
 */
export function pruneTombstones(mergedFolders: Folder[]) {
  const t = getTombstones();
  const liveFolderIds = new Set(mergedFolders.map((f) => f.id));
  const liveGameIds = new Set<string>();
  mergedFolders.forEach((f) => f.games?.forEach((g) => liveGameIds.add(g.id)));
  let changed = false;
  Object.keys(t.folders).forEach((id) => {
    if (!liveFolderIds.has(id)) {
      // Absent everywhere after sync -> cloud copy is gone, safe to forget.
      delete t.folders[id];
      changed = true;
    }
  });
  Object.keys(t.games).forEach((id) => {
    if (!liveGameIds.has(id)) {
      delete t.games[id];
      changed = true;
    }
  });
  if (changed) saveTombstones(t);
}
