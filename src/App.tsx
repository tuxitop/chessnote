import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  FolderPlus, 
  FilePlus, 
  Sparkles, 
  Keyboard, 
  Moon, 
  Sun,
  Info,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Folder, Game, MovePly } from './types';
import { getCurrentDateString, generateId } from './utils/pgn';
import Sidebar from './components/Sidebar';
import GameEditor from './components/GameEditor';
import ImportModal from './components/ImportModal';
import HotkeyModal from './components/HotkeyModal';
import GistSyncModal from './components/GistSyncModal';

// Seed initial example data
const SEED_FOLDERS = (): Folder[] => {
  const today = getCurrentDateString();
  return [
    {
      id: 'folder-seed-1',
      name: today,
      games: [
        {
          id: 'game-seed-1',
          title: 'Game 1 - Welcome Demo',
          date: today,
          startingColor: 'white',
          event: 'Welcome Casual Game',
          site: 'Chess Notation Manager',
          whitePlayer: 'Alexander Alekhine',
          blackPlayer: 'Jose Raul Capablanca',
          result: '1/2-1/2',
          notes: 'Welcome! This is an illustrative sample game. Try using the keyboard shortcuts to navigate (Ctrl + H to open the cheat sheet, Ctrl + Arrows to switch games, space to input moves). You can click on any move here to edit or comment on it!',
          moves: [
            { id: 'm-1', move: 'e4', comment: 'Open Game starts' },
            { id: 'm-2', move: 'e5' },
            { id: 'm-3', move: 'Nf3', comment: 'King\'s knight attack' },
            { id: 'm-4', move: 'Nc6' },
            { id: 'm-5', move: 'Bb5', comment: 'Ruy Lopez structure' },
            { id: 'm-6', move: 'a6' },
            { id: 'm-7', move: 'Ba4' },
            { id: 'm-8', move: 'Nf6' },
            { id: 'm-9', move: 'O-O' },
            { id: 'm-10', move: 'Be7' },
            { id: 'm-11', move: 'Re1' },
            { id: 'm-12', move: 'b5' },
            { id: 'm-13', move: 'Bb3' },
            { id: 'm-14', move: 'd6' }
          ]
        }
      ]
    }
  ];
};

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Left Sidebar width and collapse states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('left-sidebar-width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('left-sidebar-collapsed');
    return saved === 'true';
  });

  const handleLeftResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(220, Math.min(480, startWidth + delta));
      setSidebarWidth(newWidth);
      localStorage.setItem('left-sidebar-width', String(newWidth));
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };
  
  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHotkeyOpen, setIsHotkeyOpen] = useState(false);
  const [isGistSyncOpen, setIsGistSyncOpen] = useState(false);

  // Gist Cloud Sync States
  const [syncInterval, setSyncInterval] = useState<string>(() => localStorage.getItem('gist_sync_interval') || 'manual');
  const [isBgSyncing, setIsBgSyncing] = useState<boolean>(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState<boolean>(() => localStorage.getItem('gist_sync_has_unsynced_changes') === 'true');
  const [autoSyncOnChanges, setAutoSyncOnChanges] = useState<boolean>(() => {
    const saved = localStorage.getItem('gist_sync_auto_on_changes');
    return saved !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('gist_sync_auto_on_changes', String(autoSyncOnChanges));
  }, [autoSyncOnChanges]);

  useEffect(() => {
    localStorage.setItem('gist_sync_has_unsynced_changes', String(hasUnsyncedChanges));
  }, [hasUnsyncedChanges]);

  // Status/Alerts
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Show a disappearing auto-save notification
  const triggerAlert = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAlertMsg({ text, type });
    const timer = setTimeout(() => {
      setAlertMsg(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // 1. Load data from localStorage
  useEffect(() => {
    // Check dark mode preference
    const savedTheme = localStorage.getItem('chess_notation_dark_mode');
    if (savedTheme === 'true') {
      setDarkMode(true);
    }

    const savedData = localStorage.getItem('chess_notation_folders');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData) as Folder[];
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setFolders(parsed);
          
          // Check if there is a saved active game and folder
          const savedActiveFolderId = localStorage.getItem('chess_notation_active_folder_id');
          const savedActiveGameId = localStorage.getItem('chess_notation_active_game_id');
          
          let folderToSelect = parsed[0].id;
          let gameToSelect = parsed[0].games.length > 0 ? parsed[0].games[0].id : null;
          
          if (savedActiveFolderId && parsed.some(f => f.id === savedActiveFolderId)) {
            folderToSelect = savedActiveFolderId;
            const targetFolder = parsed.find(f => f.id === savedActiveFolderId);
            if (targetFolder) {
              if (savedActiveGameId && targetFolder.games.some(g => g.id === savedActiveGameId)) {
                gameToSelect = savedActiveGameId;
              } else if (targetFolder.games.length > 0) {
                gameToSelect = targetFolder.games[0].id;
              } else {
                gameToSelect = null;
              }
            }
          }
          
          setActiveFolderId(folderToSelect);
          setActiveGameId(gameToSelect);
        } else {
          // If empty array, use seeds
          const seed = SEED_FOLDERS();
          setFolders(seed);
          setActiveFolderId(seed[0].id);
          setActiveGameId(seed[0].games[0].id);
        }
      } catch (e) {
        console.error('Error loading folders from local storage:', e);
        const seed = SEED_FOLDERS();
        setFolders(seed);
        setActiveFolderId(seed[0].id);
        setActiveGameId(seed[0].games[0].id);
      }
    } else {
      const seed = SEED_FOLDERS();
      setFolders(seed);
      setActiveFolderId(seed[0].id);
      setActiveGameId(seed[0].games[0].id);
    }
  }, [triggerAlert]);

  // Sync active folder and game to localStorage
  useEffect(() => {
    if (activeFolderId) {
      localStorage.setItem('chess_notation_active_folder_id', activeFolderId);
    } else {
      localStorage.removeItem('chess_notation_active_folder_id');
    }
  }, [activeFolderId]);

  useEffect(() => {
    if (activeGameId) {
      localStorage.setItem('chess_notation_active_game_id', activeGameId);
    } else {
      localStorage.removeItem('chess_notation_active_game_id');
    }
  }, [activeGameId]);

  // 2. Sync dark mode to document body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#09090b'; // zinc-950
      document.body.style.color = '#e4e4e7'; // zinc-200
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#fcfcfc'; // stone-50
      document.body.style.color = '#1c1917'; // stone-800
    }
    localStorage.setItem('chess_notation_dark_mode', String(darkMode));
  }, [darkMode]);

  // Save changes to local storage helper
  const saveFoldersToLocalStorage = (updatedFolders: Folder[]) => {
    localStorage.setItem('chess_notation_folders', JSON.stringify(updatedFolders));
    // Trigger subtle save alert
    triggerAlert('Data auto-saved to local scorebook');
    setHasUnsyncedChanges(true);
  };

  // CREATE FOLDER
  const handleCreateFolder = (name?: string, parentId?: string | null): string => {
    const folderName = name || getCurrentDateString();
    
    // Check if folder name already exists under the same parent to prevent confusion
    let finalName = folderName;
    let count = 1;
    while (folders.some(f => f.name === finalName && (f.parentId || null) === (parentId || null))) {
      finalName = `${folderName} (${count})`;
      count++;
    }

    const newFolder: Folder = {
      id: 'f-' + generateId(),
      name: finalName,
      games: [],
      parentId: parentId || null
    };

    const updated = [newFolder, ...folders];
    setFolders(updated);
    setActiveFolderId(newFolder.id);
    setActiveGameId(null);
    saveFoldersToLocalStorage(updated);
    triggerAlert(`Created collection "${newFolder.name}"`);
    return newFolder.id;
  };

  // RENAME FOLDER
  const handleRenameFolder = (id: string, newName: string) => {
    const updated = folders.map(f => {
      if (f.id === id) {
        return { ...f, name: newName };
      }
      return f;
    });
    setFolders(updated);
    saveFoldersToLocalStorage(updated);
    triggerAlert(`Renamed collection to "${newName}"`);
  };

  // DELETE FOLDER
  const handleDeleteFolder = (id: string) => {
    // Delete target folder and all nested child folders recursively
    const findChildrenIds = (parentId: string): string[] => {
      const children = folders.filter(f => f.parentId === parentId);
      return [parentId, ...children.flatMap(c => findChildrenIds(c.id))];
    };
    const folderIdsToDelete = findChildrenIds(id);
    const updated = folders.filter(f => !folderIdsToDelete.includes(f.id));
    setFolders(updated);
    
    // Reset active folder/game selection if deleted folder was active
    if (folderIdsToDelete.includes(activeFolderId || '')) {
      if (updated.length > 0) {
        setActiveFolderId(updated[0].id);
        setActiveGameId(updated[0].games.length > 0 ? updated[0].games[0].id : null);
      } else {
        setActiveFolderId(null);
        setActiveGameId(null);
      }
    }
    
    saveFoldersToLocalStorage(updated);
    triggerAlert('Collection deleted successfully', 'info');
  };

  // CREATE GAME
  const handleCreateGame = (folderId: string): string => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return '';

    // Calculate game number based on games length inside folder
    const gameNumber = folder.games.length + 1;

    const newGame: Game = {
      id: 'g-' + generateId(),
      title: `Game ${gameNumber}`,
      date: getCurrentDateString(),
      startingColor: 'white',
      moves: [],
      notes: ''
    };

    const updated = folders.map(f => {
      if (f.id === folderId) {
        return {
          ...f,
          games: [newGame, ...f.games] // Prepend for quick top-of-list access
        };
      }
      return f;
    });

    setFolders(updated);
    setActiveFolderId(folderId);
    setActiveGameId(newGame.id);
    saveFoldersToLocalStorage(updated);
    triggerAlert(`Created new blank scoresheet "${newGame.title}"`);
    return newGame.id;
  };

  // MOVE GAME (FOR DRAG AND DROP)
  const handleMoveGame = (gameId: string, sourceFolderId: string, targetFolderId: string) => {
    const sourceFolder = folders.find(f => f.id === sourceFolderId);
    if (!sourceFolder) return;
    const gameToMove = sourceFolder.games.find(g => g.id === gameId);
    if (!gameToMove) return;

    const updated = folders.map(f => {
      if (f.id === sourceFolderId && f.id === targetFolderId) {
        return f;
      }
      if (f.id === sourceFolderId) {
        return {
          ...f,
          games: f.games.filter(g => g.id !== gameId)
        };
      }
      if (f.id === targetFolderId) {
        return {
          ...f,
          games: [gameToMove, ...f.games]
        };
      }
      return f;
    });

    setFolders(updated);
    setActiveFolderId(targetFolderId);
    setActiveGameId(gameId);
    saveFoldersToLocalStorage(updated);
    triggerAlert(`Moved game "${gameToMove.title}" to target collection`);
  };

  // MOVE FOLDER (FOR DRAG AND DROP)
  const handleMoveFolder = (folderId: string, targetParentId: string | null) => {
    // Prevent cycle: folderId cannot be targetParentId, nor can targetParentId be a descendant of folderId
    if (folderId === targetParentId) return;

    const isDescendant = (parent: string, child: string): boolean => {
      const childFolder = folders.find(f => f.id === child);
      if (!childFolder || !childFolder.parentId) return false;
      if (childFolder.parentId === parent) return true;
      return isDescendant(parent, childFolder.parentId);
    };

    if (targetParentId && isDescendant(folderId, targetParentId)) {
      triggerAlert("Cannot nest a collection inside its own subcollection", "error");
      return;
    }

    const updated = folders.map(f => {
      if (f.id === folderId) {
        return { ...f, parentId: targetParentId };
      }
      return f;
    });

    setFolders(updated);
    saveFoldersToLocalStorage(updated);
    triggerAlert("Collection structure updated successfully");
    setHasUnsyncedChanges(true);
  };

  // UPDATE GAME DETAILS / MOVES
  const handleUpdateGame = (updatedGame: Game) => {
    const updated = folders.map(f => {
      if (f.games.some(g => g.id === updatedGame.id)) {
        return {
          ...f,
          games: f.games.map(g => g.id === updatedGame.id ? updatedGame : g)
        };
      }
      return f;
    });
    setFolders(updated);
    // Explicit save without flashing too many alerts for every single keystroke
    localStorage.setItem('chess_notation_folders', JSON.stringify(updated));
    setHasUnsyncedChanges(true);
  };

  // DELETE GAME
  const handleDeleteGame = (gameId: string) => {
    let deletedFromFolderId = '';
    const updated = folders.map(f => {
      if (f.games.some(g => g.id === gameId)) {
        deletedFromFolderId = f.id;
        return {
          ...f,
          games: f.games.filter(g => g.id !== gameId)
        };
      }
      return f;
    });

    setFolders(updated);
    
    // Select another game from same folder if possible
    if (activeGameId === gameId) {
      const currentFolder = updated.find(f => f.id === (deletedFromFolderId || activeFolderId));
      if (currentFolder && currentFolder.games.length > 0) {
        setActiveGameId(currentFolder.games[0].id);
      } else {
        setActiveGameId(null);
      }
    }

    saveFoldersToLocalStorage(updated);
    triggerAlert('Game notation deleted', 'info');
  };

  // SELECT ACTIVE STATE
  const handleSelectFolder = (id: string) => {
    setActiveFolderId(id);
    const folder = folders.find(f => f.id === id);
    if (folder && folder.games.length > 0) {
      setActiveGameId(folder.games[0].id);
    } else {
      setActiveGameId(null);
    }
  };

  const handleSelectGame = (folderId: string, gameId: string) => {
    setActiveFolderId(folderId);
    setActiveGameId(gameId);
  };

  // KEYBOARD SHORTCUTS
  // Switch games (prev/next in the same folder)
  const handleSwitchGame = useCallback((direction: 'prev' | 'next') => {
    if (!activeFolderId || !activeGameId) return;
    const currentFolder = folders.find(f => f.id === activeFolderId);
    if (!currentFolder || currentFolder.games.length <= 1) return;

    const currentIndex = currentFolder.games.findIndex(g => g.id === activeGameId);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'prev') {
      targetIndex = currentIndex - 1;
    } else {
      targetIndex = currentIndex + 1;
    }

    // Wrap around or cap
    if (targetIndex >= 0 && targetIndex < currentFolder.games.length) {
      setActiveGameId(currentFolder.games[targetIndex].id);
      triggerAlert(`Switched to "${currentFolder.games[targetIndex].title}"`, 'info');
    }
  }, [activeFolderId, activeGameId, folders, triggerAlert]);

  // Global keydown listeners
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isModifierPressed = e.ctrlKey || e.metaKey;

      // Alt + Shift + N: New Folder
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateFolder();
        return;
      }

      // Alt + N: New Game in selected folder
      if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (folders.length === 0) {
          const folderId = handleCreateFolder();
          handleCreateGame(folderId);
        } else {
          const targetId = activeFolderId || folders[0].id;
          handleCreateGame(targetId);
        }
        return;
      }

      if (isModifierPressed) {
        // Ctrl + H / Cmd + H: Toggle help cheatsheet
        if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          setIsHotkeyOpen(prev => !prev);
          return;
        }

        // Ctrl + S / Cmd + S: Manual save trigger
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          saveFoldersToLocalStorage(folders);
          triggerAlert('Scorebook explicitly saved to secure local storage!', 'success');
          return;
        }

        // Ctrl + E / Cmd + E: Export Current Game PGN
        if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          const activeFolder = folders.find(f => f.id === activeFolderId);
          const activeGame = activeFolder?.games.find(g => g.id === activeGameId);
          if (activeGame && activeFolder) {
            // Trigger download
            const btn = document.getElementById('btn-export-pgn');
            if (btn) btn.click();
          } else {
            triggerAlert('No active game scorebook to export!', 'error');
          }
          return;
        }

        // Ctrl + ArrowLeft / Ctrl + ArrowRight: Switch Games
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleSwitchGame('prev');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleSwitchGame('next');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [folders, activeFolderId, activeGameId, handleSwitchGame, triggerAlert]);

  // BACKUP ALL DATA (JSON Export)
  const handleBackupAllData = () => {
    const backupObj = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      folders: folders
    };

    const json = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess_notation_backup_${getCurrentDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    triggerAlert('Backup JSON file generated and downloaded!', 'success');
  };

  // RESTORE DATA (JSON Import)
  const handleRestoreData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        
        // Validation checks
        if (parsed && (Array.isArray(parsed) || (parsed.folders && Array.isArray(parsed.folders)))) {
          const restoredFolders: Folder[] = Array.isArray(parsed) ? parsed : parsed.folders;
          
          if (restoredFolders.length > 0) {
            setFolders(restoredFolders);
            setActiveFolderId(restoredFolders[0].id);
            if (restoredFolders[0].games.length > 0) {
              setActiveGameId(restoredFolders[0].games[0].id);
            } else {
              setActiveGameId(null);
            }
            saveFoldersToLocalStorage(restoredFolders);
            triggerAlert('Successfully restored scorebooks from backup!', 'success');
          } else {
            triggerAlert('Backup file contains no collections!', 'error');
          }
        } else {
          triggerAlert('Invalid backup file format. Must contain a folders collection.', 'error');
        }
      } catch (err) {
        triggerAlert('Failed to parse the backup JSON file. Ensure file is intact.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // GIST CLOUD SYNC SUCCESS HANDLER
  const handleGistSyncSuccess = (mergedFolders: Folder[], message: string) => {
    setFolders(mergedFolders);
    localStorage.setItem('chess_notation_folders', JSON.stringify(mergedFolders));
    setHasUnsyncedChanges(false);
    
    // Validate currently selected folder and game
    if (mergedFolders.length > 0) {
      const activeFolderStillExists = mergedFolders.some(f => f.id === activeFolderId);
      if (!activeFolderStillExists) {
        setActiveFolderId(mergedFolders[0].id);
        if (mergedFolders[0].games.length > 0) {
          setActiveGameId(mergedFolders[0].games[0].id);
        } else {
          setActiveGameId(null);
        }
      } else {
        const activeFolder = mergedFolders.find(f => f.id === activeFolderId);
        if (activeFolder) {
          const activeGameStillExists = activeFolder.games.some(g => g.id === activeGameId);
          if (!activeGameStillExists) {
            if (activeFolder.games.length > 0) {
              setActiveGameId(activeFolder.games[0].id);
            } else {
              setActiveGameId(null);
            }
          }
        }
      }
    } else {
      setActiveFolderId(null);
      setActiveGameId(null);
    }
    
    triggerAlert(message, 'success');
  };

  // Reference to keep track of the absolute latest folders state
  const foldersRef = React.useRef(folders);
  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  // Periodical Background Cloud Sync Effect
  useEffect(() => {
    const token = localStorage.getItem('gist_sync_token');
    const gistId = localStorage.getItem('gist_sync_id');

    if (!token || !gistId || syncInterval === 'manual') {
      return;
    }

    // Map interval strings to milliseconds
    const intervalsMap: Record<string, number> = {
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const ms = intervalsMap[syncInterval];
    if (!ms) return;

    const performBackgroundSync = async () => {
      setIsBgSyncing(true);
      try {
        const currentFolders = foldersRef.current;
        
        // 1. Fetch Cloud Gist
        const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
          headers: {
            Authorization: `token ${token.trim()}`
          }
        });

        if (!response.ok) {
          throw new Error(`Cloud fetch failed: ${response.statusText} (${response.status})`);
        }

        const gistData = await response.json();
        const fileObj = gistData.files['chess_notation_backup.json'];
        
        if (!fileObj || !fileObj.content) {
          throw new Error('chess_notation_backup.json file missing inside your Gist.');
        }

        const parsed = JSON.parse(fileObj.content);
        const cloudFolders = parsed.folders as Folder[];

        if (!cloudFolders || !Array.isArray(cloudFolders)) {
          throw new Error('Cloud Gist database format is invalid.');
        }

        // 2. Bidirectional Lossless Smart Merge
        const localFoldersMap = new Map<string, Folder>();
        currentFolders.forEach(f => localFoldersMap.set(f.id, f));

        const cloudFoldersMap = new Map<string, Folder>();
        cloudFolders.forEach(f => cloudFoldersMap.set(f.id, f));

        const allFolderIds = new Set<string>([...localFoldersMap.keys(), ...cloudFoldersMap.keys()]);
        const mergedFolders: Folder[] = [];

        allFolderIds.forEach(folderId => {
          const localFolder = localFoldersMap.get(folderId);
          const cloudFolder = cloudFoldersMap.get(folderId);

          if (localFolder && cloudFolder) {
            const localGamesMap = new Map<string, any>();
            localFolder.games.forEach(g => localGamesMap.set(g.id, g));

            const cloudGamesMap = new Map<string, any>();
            cloudFolder.games.forEach(g => cloudGamesMap.set(g.id, g));

            const allGameIds = new Set<string>([...localGamesMap.keys(), ...cloudGamesMap.keys()]);
            const mergedGames: any[] = [];

            allGameIds.forEach(gameId => {
              const localGame = localGamesMap.get(gameId);
              const cloudGame = cloudGamesMap.get(gameId);

              if (localGame && cloudGame) {
                // Compare moves, analysis reports, and notes
                const localScore = (localGame.moves?.length || 0) + (localGame.analysisReports?.length || 0) * 5 + (localGame.notes?.length || 0) * 0.1;
                const cloudScore = (cloudGame.moves?.length || 0) + (cloudGame.analysisReports?.length || 0) * 5 + (cloudGame.notes?.length || 0) * 0.1;

                if (localScore >= cloudScore) {
                  mergedGames.push(localGame);
                } else {
                  mergedGames.push(cloudGame);
                }
              } else if (localGame) {
                mergedGames.push(localGame);
              } else if (cloudGame) {
                mergedGames.push(cloudGame);
              }
            });

            mergedFolders.push({
              ...localFolder,
              name: localFolder.name || cloudFolder.name,
              parentId: localFolder.parentId || cloudFolder.parentId || null,
              games: mergedGames
            });
          } else if (localFolder) {
            mergedFolders.push(localFolder);
          } else if (cloudFolder) {
            mergedFolders.push(cloudFolder);
          }
        });

        // 3. Save merged database to Gist Cloud
        const backupData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          folders: mergedFolders
        };

        const gistPayload = {
          description: 'Chess Notation Scorebook Synchronization Database',
          files: {
            'chess_notation_backup.json': {
              content: JSON.stringify(backupData, null, 2)
            }
          }
        };

        const patchResponse = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
          method: 'PATCH',
          headers: {
            Authorization: `token ${token.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gistPayload)
        });

        if (!patchResponse.ok) {
          throw new Error(`Failed to upload merged scoresheets to cloud: ${patchResponse.statusText}`);
        }

        // 4. Update states & localStorage
        setFolders(mergedFolders);
        localStorage.setItem('chess_notation_folders', JSON.stringify(mergedFolders));
        setHasUnsyncedChanges(false);
        const now = new Date().toLocaleString();
        localStorage.setItem('gist_sync_last_time', now);

        triggerAlert('Background cloud sync completed successfully!', 'success');
      } catch (err: any) {
        console.error('Background cloud sync failure:', err);
        triggerAlert(`Background sync failed: ${err.message || err}`, 'error');
      } finally {
        setIsBgSyncing(false);
      }
    };

    // Run first background sync after 10 seconds to avoid blocking main thread on load, then run periodically
    const startupTimerId = setTimeout(performBackgroundSync, 10000);
    const intervalId = setInterval(performBackgroundSync, ms);

    return () => {
      clearTimeout(startupTimerId);
      clearInterval(intervalId);
    };
  }, [syncInterval, triggerAlert]);

  // Automatic Sync On Changes (with a 20-second debounce to avoid overloading)
  useEffect(() => {
    const token = localStorage.getItem('gist_sync_token');
    const gistId = localStorage.getItem('gist_sync_id');

    if (!autoSyncOnChanges || !token || !gistId || !hasUnsyncedChanges || isBgSyncing) {
      return;
    }

    const performAutoSyncOnChanges = async () => {
      setIsBgSyncing(true);
      try {
        const currentFolders = foldersRef.current;
        
        // 1. Fetch Cloud Gist
        const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
          headers: {
            Authorization: `token ${token.trim()}`
          }
        });

        if (!response.ok) {
          throw new Error(`Cloud fetch failed: ${response.statusText} (${response.status})`);
        }

        const gistData = await response.json();
        const fileObj = gistData.files['chess_notation_backup.json'];
        
        if (!fileObj || !fileObj.content) {
          throw new Error('chess_notation_backup.json file missing inside your Gist.');
        }

        const parsed = JSON.parse(fileObj.content);
        const cloudFolders = parsed.folders as Folder[];

        if (!cloudFolders || !Array.isArray(cloudFolders)) {
          throw new Error('Cloud Gist database format is invalid.');
        }

        // 2. Bidirectional Lossless Smart Merge
        const localFoldersMap = new Map<string, Folder>();
        currentFolders.forEach(f => localFoldersMap.set(f.id, f));

        const cloudFoldersMap = new Map<string, Folder>();
        cloudFolders.forEach(f => cloudFoldersMap.set(f.id, f));

        const allFolderIds = new Set<string>([...localFoldersMap.keys(), ...cloudFoldersMap.keys()]);
        const mergedFolders: Folder[] = [];

        allFolderIds.forEach(folderId => {
          const localFolder = localFoldersMap.get(folderId);
          const cloudFolder = cloudFoldersMap.get(folderId);

          if (localFolder && cloudFolder) {
            const localGamesMap = new Map<string, any>();
            localFolder.games.forEach(g => localGamesMap.set(g.id, g));

            const cloudGamesMap = new Map<string, any>();
            cloudFolder.games.forEach(g => cloudGamesMap.set(g.id, g));

            const allGameIds = new Set<string>([...localGamesMap.keys(), ...cloudGamesMap.keys()]);
            const mergedGames: any[] = [];

            allGameIds.forEach(gameId => {
              const localGame = localGamesMap.get(gameId);
              const cloudGame = cloudGamesMap.get(gameId);

              if (localGame && cloudGame) {
                const localScore = (localGame.moves?.length || 0) + (localGame.analysisReports?.length || 0) * 5 + (localGame.notes?.length || 0) * 0.1;
                const cloudScore = (cloudGame.moves?.length || 0) + (cloudGame.analysisReports?.length || 0) * 5 + (cloudGame.notes?.length || 0) * 0.1;

                if (localScore >= cloudScore) {
                  mergedGames.push(localGame);
                } else {
                  mergedGames.push(cloudGame);
                }
              } else if (localGame) {
                mergedGames.push(localGame);
              } else if (cloudGame) {
                mergedGames.push(cloudGame);
              }
            });

            mergedFolders.push({
              ...localFolder,
              name: localFolder.name || cloudFolder.name,
              parentId: localFolder.parentId || cloudFolder.parentId || null,
              games: mergedGames
            });
          } else if (localFolder) {
            mergedFolders.push(localFolder);
          } else if (cloudFolder) {
            mergedFolders.push(cloudFolder);
          }
        });

        // 3. Save merged database to Gist Cloud
        const backupData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          folders: mergedFolders
        };

        const gistPayload = {
          description: 'Chess Notation Scorebook Synchronization Database',
          files: {
            'chess_notation_backup.json': {
              content: JSON.stringify(backupData, null, 2)
            }
          }
        };

        const patchResponse = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
          method: 'PATCH',
          headers: {
            Authorization: `token ${token.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gistPayload)
        });

        if (!patchResponse.ok) {
          throw new Error(`Failed to upload merged scoresheets to cloud: ${patchResponse.statusText}`);
        }

        // 4. Update states & localStorage
        setFolders(mergedFolders);
        localStorage.setItem('chess_notation_folders', JSON.stringify(mergedFolders));
        setHasUnsyncedChanges(false);
        const now = new Date().toLocaleString();
        localStorage.setItem('gist_sync_last_time', now);

        triggerAlert('Automatic cloud sync completed successfully!', 'success');
      } catch (err: any) {
        console.error('Automatic cloud sync failure:', err);
        triggerAlert(`Automatic sync failed: ${err.message || err}`, 'error');
      } finally {
        setIsBgSyncing(false);
      }
    };

    const timer = setTimeout(performAutoSyncOnChanges, 20000); // 20-second debounce to avoid overloading GitHub servers

    return () => clearTimeout(timer);
  }, [autoSyncOnChanges, hasUnsyncedChanges, folders, triggerAlert]);

  // IMPORT PGN SUCCESS HANDLER
  const handleImportSuccess = (
    importedGames: Partial<Game>[],
    folderOption: 'current' | 'new',
    newFolderName?: string
  ) => {
    let targetFolderId = activeFolderId;

    const fullImportedGames: Game[] = importedGames.map(pg => ({
      id: pg.id || 'g-' + generateId(),
      title: pg.title || 'Imported Game',
      date: pg.date || getCurrentDateString(),
      startingColor: pg.startingColor || 'white',
      moves: pg.moves as MovePly[] || [],
      notes: pg.notes || '',
      event: pg.event,
      site: pg.site,
      whitePlayer: pg.whitePlayer,
      blackPlayer: pg.blackPlayer,
      result: pg.result || '*',
      initialFen: pg.initialFen,
      themes: pg.themes,
      puzzleStatus: pg.puzzleStatus
    }));

    let updatedFolders = [...folders];

    if (folderOption === 'new' || !targetFolderId || folders.length === 0) {
      // Create a new folder
      const fName = newFolderName || `Imported PGNs - ${getCurrentDateString()}`;
      const newFolder: Folder = {
        id: 'f-' + generateId(),
        name: fName,
        games: fullImportedGames
      };
      updatedFolders = [newFolder, ...updatedFolders];
      targetFolderId = newFolder.id;
    } else {
      // Append to currently selected folder
      updatedFolders = folders.map(f => {
        if (f.id === targetFolderId) {
          return {
            ...f,
            games: [...fullImportedGames, ...f.games] // prepending
          };
        }
        return f;
      });
    }

    setFolders(updatedFolders);
    setActiveFolderId(targetFolderId);
    if (fullImportedGames.length > 0) {
      setActiveGameId(fullImportedGames[0].id);
    }
    
    setIsImportOpen(false);
    saveFoldersToLocalStorage(updatedFolders);
    triggerAlert(`Successfully imported ${fullImportedGames.length} game(s)!`, 'success');
  };

  // Extract active game and active folder
  const currentFolder = folders.find(f => f.id === activeFolderId);
  const currentGame = currentFolder?.games.find(g => g.id === activeGameId);

  return (
    <div className={`w-screen h-screen flex overflow-hidden transition-all-300 font-sans ${
      darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-stone-50 text-stone-900'
    }`} id="app-root-layout">
      
      {/* Sidebar Component Wrapper with Dynamic Width */}
      <div 
        style={{ width: isSidebarCollapsed ? 0 : sidebarWidth }} 
        className="h-full relative shrink-0 overflow-hidden transition-all duration-300 ease-out flex"
      >
        <Sidebar
          folders={folders}
          activeFolderId={activeFolderId}
          activeGameId={activeGameId}
          onSelectFolder={handleSelectFolder}
          onSelectGame={handleSelectGame}
          onCreateFolder={handleCreateFolder}
          onCreateGame={handleCreateGame}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onBackup={handleBackupAllData}
          onRestore={handleRestoreData}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenGistSync={() => setIsGistSyncOpen(true)}
          isBgSyncing={isBgSyncing}
          hasUnsyncedChanges={hasUnsyncedChanges && !!localStorage.getItem('gist_sync_token') && !!localStorage.getItem('gist_sync_id')}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onMoveGame={handleMoveGame}
          onMoveFolder={handleMoveFolder}
          onUpdateGame={handleUpdateGame}
          onDeleteGame={handleDeleteGame}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => {
            const next = !isSidebarCollapsed;
            setIsSidebarCollapsed(next);
            localStorage.setItem('left-sidebar-collapsed', String(next));
          }}
        />
      </div>

      {/* Resize Handle for Left Sidebar */}
      {!isSidebarCollapsed && (
        <div 
          onPointerDown={handleLeftResize}
          className="w-1 hover:w-1.5 hover:bg-amber-500/50 bg-transparent cursor-col-resize select-none h-full z-40 transition-all shrink-0"
          style={{ marginRight: '-2px', marginLeft: '-2px' }}
        />
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 h-full flex flex-col relative overflow-hidden" id="main-frame-layout">
        
        {/* Floating Expand Sidebar Button when Collapsed */}
        {isSidebarCollapsed && (
          <button
            onClick={() => {
              setIsSidebarCollapsed(false);
              localStorage.setItem('left-sidebar-collapsed', 'false');
            }}
            className={`absolute top-4 left-4 z-45 p-2 rounded-lg border shadow-md transition-all flex items-center justify-center hover:scale-[1.05] ${
              darkMode 
                ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-amber-500 hover:text-amber-400' 
                : 'bg-white hover:bg-stone-100 border-stone-200 text-amber-600 hover:text-amber-500'
            }`}
            title="Expand Sidebar"
            id="floating-expand-sidebar-btn"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        
        {/* Disappearing Save/Error alerts overlay */}
        {alertMsg && (
          <div 
            onClick={() => setAlertMsg(null)}
            className="absolute top-4 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md animate-fade-in border border-opacity-30 bg-opacity-95 backdrop-blur-xs cursor-pointer select-none" 
            id="toast-notification"
            title="Click to dismiss"
          >
            {alertMsg.type === 'success' && (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-500 animate-bounce" />
                <span>{alertMsg.text}</span>
              </div>
            )}
            {alertMsg.type === 'error' && (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>{alertMsg.text}</span>
              </div>
            )}
            {alertMsg.type === 'info' && (
              <div className="flex items-center gap-2 bg-stone-100 dark:bg-zinc-900/90 text-stone-800 dark:text-zinc-300 border-stone-300 dark:border-zinc-800">
                <Info className="w-4 h-4 text-stone-500 dark:text-zinc-500" />
                <span>{alertMsg.text}</span>
              </div>
            )}
          </div>
        )}

        {currentGame && currentFolder ? (
          <GameEditor
            game={currentGame}
            folderName={currentFolder.name}
            onUpdateGame={handleUpdateGame}
            onDeleteGame={handleDeleteGame}
            darkMode={darkMode}
          />
        ) : (
          /* Large workspace empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8" id="workspace-empty-state">
            <div className={`p-4 rounded-full mb-4 ${
              darkMode ? 'bg-zinc-900 text-amber-400' : 'bg-amber-50 text-amber-800'
            }`}>
              <Sparkles className="w-10 h-10 animate-pulse" />
            </div>
            
            <h2 className="text-xl font-bold tracking-tight mb-2">No Active Chess Game Selected</h2>
            <p className={`text-xs max-w-md mx-auto mb-6 leading-relaxed ${
              darkMode ? 'text-zinc-500' : 'text-stone-500'
            }`}>
              Select an existing game scorebook from the sidebar folder directory, or click below to start a brand new chess record sheet immediately.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  const fId = handleCreateFolder();
                  handleCreateGame(fId);
                }}
                className={`flex items-center gap-1.5 py-2 px-4 text-xs font-semibold rounded-lg border transition-colors ${
                  darkMode
                    ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-zinc-200'
                    : 'bg-white border-stone-250 hover:bg-stone-100 text-stone-700'
                }`}
                id="empty-state-new-folder-btn"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                Create Collection Folder
              </button>
              
              <button
                onClick={() => {
                  let fId = activeFolderId;
                  if (!fId) {
                    if (folders.length > 0) {
                      fId = folders[0].id;
                    } else {
                      fId = handleCreateFolder();
                    }
                  }
                  handleCreateGame(fId);
                }}
                className="flex items-center gap-1.5 py-2 px-4 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors shadow-sm shadow-amber-900/10"
                id="empty-state-new-game-btn"
              >
                <Plus className="w-4 h-4" />
                Start Recording Game
              </button>
            </div>

            {/* Quick stats footer for empty state */}
            <div className="mt-16 flex items-center justify-center gap-4">
              <button 
                onClick={() => setIsHotkeyOpen(true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                  darkMode ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-400' : 'border-stone-200 hover:bg-stone-100 text-stone-600'
                }`}
                id="btn-help-empty-state"
              >
                <Keyboard className="w-4 h-4" />
                Show Cheat Sheet (Ctrl + H)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk PGN Import Modal Overlay */}
      {isImportOpen && (
        <ImportModal
          folders={folders}
          activeFolderId={activeFolderId}
          onClose={() => setIsImportOpen(false)}
          onImportSuccess={handleImportSuccess}
          darkMode={darkMode}
        />
      )}

      {/* Keyboard Shortcuts Cheatsheet Modal Overlay */}
      {isHotkeyOpen && (
        <HotkeyModal
          onClose={() => setIsHotkeyOpen(false)}
          darkMode={darkMode}
        />
      )}

      {/* GitHub Gist Cloud Sync Modal Overlay */}
      {isGistSyncOpen && (
        <GistSyncModal
          onClose={() => setIsGistSyncOpen(false)}
          folders={folders}
          onSyncSuccess={handleGistSyncSuccess}
          darkMode={darkMode}
          syncInterval={syncInterval}
          onSetSyncInterval={setSyncInterval}
          autoSyncOnChanges={autoSyncOnChanges}
          onSetAutoSyncOnChanges={setAutoSyncOnChanges}
        />
      )}

    </div>
  );
}
