import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder as FolderIcon, 
  FolderPlus, 
  FilePlus, 
  Trash2, 
  Edit2, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Download, 
  Upload, 
  FileText, 
  Sparkles,
  HelpCircle,
  Sun,
  Moon,
  Info,
  Check,
  X,
  Star,
  Tag,
  Puzzle,
  Trophy,
  ArrowUpAZ,
  ArrowDownAZ,
  Cloud
} from 'lucide-react';
import { Folder, Game } from '../types';

interface SidebarProps {
  folders: Folder[];
  activeFolderId: string | null;
  activeGameId: string | null;
  onSelectFolder: (id: string) => void;
  onSelectGame: (folderId: string, gameId: string) => void;
  onCreateFolder: (name?: string, parentId?: string | null) => string;
  onCreateGame: (folderId: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onBackup: () => void;
  onRestore: (file: File) => void;
  onOpenImport: () => void;
  onOpenGistSync?: () => void;
  isBgSyncing?: boolean;
  hasUnsyncedChanges?: boolean;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onMoveGame?: (gameId: string, sourceFolderId: string, targetFolderId: string) => void;
  onMoveFolder?: (folderId: string, targetParentId: string | null) => void;
  onUpdateGame?: (updatedGame: Game) => void;
  onDeleteGame?: (gameId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getGameIcon = (game: Game, isPuzzleInHub = false) => {
  const isPuzzle = isPuzzleInHub || !!(
    game.initialFen || 
    game.puzzleStatus || 
    (game.themes && game.themes.trim() !== '')
  );
  if (isPuzzle) return Puzzle;
  
  const isComplete = !!(
    game.whitePlayer && game.whitePlayer.trim() !== '' &&
    game.blackPlayer && game.blackPlayer.trim() !== ''
  );
  return isComplete ? Trophy : Sparkles;
};

export default function Sidebar({
  folders,
  activeFolderId,
  activeGameId,
  onSelectFolder,
  onSelectGame,
  onCreateFolder,
  onCreateGame,
  onRenameFolder,
  onDeleteFolder,
  onBackup,
  onRestore,
  onOpenImport,
  onOpenGistSync,
  isBgSyncing = false,
  hasUnsyncedChanges = false,
  darkMode,
  setDarkMode,
  onMoveGame,
  onMoveFolder,
  onUpdateGame,
  onDeleteGame,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting state (ascending by default)
  const [sortAscending, setSortAscending] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar-sort-ascending');
    return saved !== 'false'; // default is true
  });

  useEffect(() => {
    localStorage.setItem('sidebar-sort-ascending', String(sortAscending));
  }, [sortAscending]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // Game renaming and deletion states
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingGameTitle, setEditingGameTitle] = useState('');
  const [confirmDeleteGameId, setConfirmDeleteGameId] = useState<string | null>(null);
  const renameGameInputRef = useRef<HTMLInputElement>(null);

  // Puzzle Hub UI States
  const [isPuzzleHubExpanded, setIsPuzzleHubExpanded] = useState(true);
  const [expandedPuzzleSub, setExpandedPuzzleSub] = useState<Record<string, boolean>>({
    all: true,
    solved: false,
    failed: false,
    unsolved: true,
    themes: false
  });
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});
  const [puzzleHubHeight, setPuzzleHubHeight] = useState(250);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = puzzleHubHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(100, Math.min(550, startHeight - deltaY));
      setPuzzleHubHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const startY = e.touches[0].clientY;
    const startHeight = puzzleHubHeight;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const deltaY = moveEvent.touches[0].clientY - startY;
      const newHeight = Math.max(100, Math.min(550, startHeight - deltaY));
      setPuzzleHubHeight(newHeight);
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand folder of active game
  useEffect(() => {
    if (activeFolderId) {
      setExpandedFolders(prev => ({
        ...prev,
        [activeFolderId]: true
      }));
    }
  }, [activeFolderId]);

  // Focus rename input
  useEffect(() => {
    if (editingFolderId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingFolderId]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
    onSelectFolder(folderId);
  };

  const startRenaming = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const saveRename = (folderId: string) => {
    if (editingFolderName.trim()) {
      onRenameFolder(folderId, editingFolderName.trim());
    }
    setEditingFolderId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, folderId: string) => {
    if (e.key === 'Enter') {
      saveRename(folderId);
    } else if (e.key === 'Escape') {
      setEditingFolderId(null);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRestore(file);
      // Clear value to allow reloading the same file if needed
      e.target.value = '';
    }
  };

  // Filter games and folders based on query
  const filteredFolders = folders.map(folder => {
    const matchingGames = folder.games.filter(game => {
      const q = searchQuery.toLowerCase();
      return (
        game.title.toLowerCase().includes(q) ||
        (game.whitePlayer || '').toLowerCase().includes(q) ||
        (game.blackPlayer || '').toLowerCase().includes(q) ||
        (game.notes || '').toLowerCase().includes(q) ||
        game.date.includes(q)
      );
    });

    const isFolderMatch = folder.name.toLowerCase().includes(searchQuery.toLowerCase());

    return {
      ...folder,
      // If folder name matches, show all its games, else show only matching games
      filteredGames: isFolderMatch ? folder.games : matchingGames,
      isMatch: isFolderMatch || matchingGames.length > 0
    };
  }).filter(f => f.isMatch);

  // Compute all puzzles across all folders
  const allPuzzles: { game: Game; folderId: string }[] = [];
  folders.forEach(folder => {
    folder.games.forEach(game => {
      if (game.initialFen) {
        allPuzzles.push({ game, folderId: folder.id });
      }
    });
  });

  const filteredAllPuzzles = allPuzzles.filter(({ game }) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      game.title.toLowerCase().includes(q) ||
      (game.whitePlayer || '').toLowerCase().includes(q) ||
      (game.blackPlayer || '').toLowerCase().includes(q) ||
      (game.notes || '').toLowerCase().includes(q) ||
      (game.themes || '').toLowerCase().includes(q) ||
      game.date.includes(q)
    );
  });

  const solvedPuzzles = filteredAllPuzzles.filter(({ game }) => game.puzzleStatus === 'solved');
  const failedPuzzles = filteredAllPuzzles.filter(({ game }) => game.puzzleStatus === 'failed');
  const unsolvedPuzzles = filteredAllPuzzles.filter(({ game }) => game.puzzleStatus === 'unsolved' || !game.puzzleStatus);

  // Get all unique themes
  const themeMap: Record<string, { game: Game; folderId: string }[]> = {};
  filteredAllPuzzles.forEach(({ game, folderId }) => {
    if (game.themes) {
      const list = game.themes.split(/,\s*/);
      list.forEach(t => {
        const themeClean = t.trim();
        if (themeClean) {
          if (!themeMap[themeClean]) {
            themeMap[themeClean] = [];
          }
          themeMap[themeClean].push({ game, folderId });
        }
      });
    }
  });

  // Sorted puzzle arrays for the Puzzle Hub
  const sortedAllPuzzles = [...filteredAllPuzzles].sort((a, b) => {
    const comparison = a.game.title.localeCompare(b.game.title, undefined, { numeric: true, sensitivity: 'base' });
    return sortAscending ? comparison : -comparison;
  });

  const sortedUnsolvedPuzzles = [...unsolvedPuzzles].sort((a, b) => {
    const comparison = a.game.title.localeCompare(b.game.title, undefined, { numeric: true, sensitivity: 'base' });
    return sortAscending ? comparison : -comparison;
  });

  const sortedSolvedPuzzles = [...solvedPuzzles].sort((a, b) => {
    const comparison = a.game.title.localeCompare(b.game.title, undefined, { numeric: true, sensitivity: 'base' });
    return sortAscending ? comparison : -comparison;
  });

  const sortedFailedPuzzles = [...failedPuzzles].sort((a, b) => {
    const comparison = a.game.title.localeCompare(b.game.title, undefined, { numeric: true, sensitivity: 'base' });
    return sortAscending ? comparison : -comparison;
  });

  const togglePuzzleSub = (key: string) => {
    setExpandedPuzzleSub(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleTheme = (themeName: string) => {
    setExpandedThemes(prev => ({
      ...prev,
      [themeName]: !prev[themeName]
    }));
  };

  const renderPuzzleGameItem = (game: Game, folderId: string) => {
    const isGameSelected = activeGameId === game.id;
    const IconComponent = getGameIcon(game, true);
    return (
      <div
        key={game.id}
        onClick={() => onSelectGame(folderId, game.id)}
        className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-all ${
          isGameSelected
            ? darkMode 
              ? 'bg-amber-500/15 text-amber-300 font-semibold border-l-2 border-amber-500 pl-1' 
              : 'bg-stone-200 text-stone-900 font-semibold border-l-2 border-amber-600 pl-1'
            : darkMode
              ? 'hover:bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 pl-1.5'
              : 'hover:bg-stone-100/80 text-stone-600 hover:text-stone-900 pl-1.5'
        }`}
        id={`puzzle-game-item-${game.id}`}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          <IconComponent className={`w-3.5 h-3.5 shrink-0 ${
            isGameSelected 
              ? 'text-amber-500' 
              : darkMode ? 'text-zinc-500' : 'text-stone-400'
          }`} />
          <div className="flex flex-col overflow-hidden">
            <span className="text-[11px] truncate">{game.title}</span>
            <span className={`text-[9px] truncate opacity-75 ${
              darkMode ? 'text-zinc-500' : 'text-stone-500'
            }`}>
              {game.date}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {game.puzzleStatus === 'solved' && (
            <span className="text-[10px]" title="Solved">🟢</span>
          )}
          {game.puzzleStatus === 'failed' && (
            <span className="text-[10px]" title="Failed">🔴</span>
          )}
          {(game.puzzleStatus === 'unsolved' || !game.puzzleStatus) && (
            <span className="text-[10px]" title="Unsolved">⚪</span>
          )}
        </div>
      </div>
    );
  };

  const startRenamingGame = (game: Game, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGameId(game.id);
    setEditingGameTitle(game.title);
  };

  const saveRenameGame = (gameId: string) => {
    if (editingGameTitle.trim() && onUpdateGame) {
      // Find the game in any of the folders
      const g = folders.flatMap(f => f.games).find(x => x.id === gameId);
      if (g) {
        onUpdateGame({ ...g, title: editingGameTitle.trim() });
      }
    }
    setEditingGameId(null);
  };

  const handleRenameGameKeyDown = (e: React.KeyboardEvent, gameId: string) => {
    if (e.key === 'Enter') {
      saveRenameGame(gameId);
    } else if (e.key === 'Escape') {
      setEditingGameId(null);
    }
  };

  // Recursive search matching check
  const getFolderMatches = (folder: Folder): boolean => {
    if (!searchQuery) return true;
    if (folder.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    
    const hasMatchingGame = folder.games.some(g => 
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.whitePlayer && g.whitePlayer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.blackPlayer && g.blackPlayer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.tags && g.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
    );
    if (hasMatchingGame) return true;
    
    const subfolders = folders.filter(f => f.parentId === folder.id);
    return subfolders.some(sf => getFolderMatches(sf));
  };

  const renderFolderTree = (parentId: string | null = null, depth: number = 0) => {
    // Filter folders belonging to this parentId
    const levelFolders = folders.filter(f => (f.parentId || null) === parentId);
    
    // Filter level folders that match or contain matching items
    const matchingFolders = levelFolders.filter(f => getFolderMatches(f));

    if (matchingFolders.length === 0) return null;

    // Sort folders alphabetically or backwards
    const sortedFolders = [...matchingFolders].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return sortAscending ? comparison : -comparison;
    });

    return (
      <div className={`flex flex-col gap-1 ${depth > 0 ? 'ml-2 pl-2 border-l border-dashed border-stone-200 dark:border-zinc-800' : ''}`}>
        {sortedFolders.map(folder => {
          const isSelected = activeFolderId === folder.id;
          const isExpanded = expandedFolders[folder.id] || searchQuery.length > 0;
          
          // Child subfolders & games list matching
          const subfolders = folders.filter(f => f.parentId === folder.id);
          const filteredGames = folder.games.filter(g => {
            if (!searchQuery) return true;
            return g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (g.whitePlayer && g.whitePlayer.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (g.blackPlayer && g.blackPlayer.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (g.tags && g.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
          });

          // Sort games alphabetically or backwards by title
          const sortedGames = [...filteredGames].sort((a, b) => {
            const comparison = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
            return sortAscending ? comparison : -comparison;
          });

          return (
            <div 
              key={folder.id} 
              className={`rounded-lg border transition-all ${
                isSelected 
                  ? darkMode ? 'border-zinc-700 bg-zinc-900/40' : 'border-stone-300 bg-stone-100/50'
                  : darkMode ? 'border-transparent hover:border-zinc-850' : 'border-transparent hover:border-stone-100'
              }`}
              id={`folder-item-${folder.id}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  const dataStr = e.dataTransfer.getData('text/plain');
                  if (!dataStr) return;
                  const data = JSON.parse(dataStr);
                  
                  // Check if it's a game being dropped
                  if (data.gameId && data.sourceFolderId) {
                    if (data.sourceFolderId !== folder.id && onMoveGame) {
                      onMoveGame(data.gameId, data.sourceFolderId, folder.id);
                    }
                  }
                  // Check if it's a folder being dropped
                  else if (data.dragFolderId) {
                    if (data.dragFolderId !== folder.id && onMoveFolder) {
                      onMoveFolder(data.dragFolderId, folder.id);
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              {/* Folder Row */}
              <div 
                onClick={() => toggleFolder(folder.id)}
                className={`flex items-center justify-between p-2 rounded-t-lg cursor-pointer group ${
                  darkMode ? 'hover:bg-zinc-900/60' : 'hover:bg-stone-100/80'
                }`}
                draggable={true}
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('text/plain', JSON.stringify({ dragFolderId: folder.id }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  {isExpanded ? (
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                  ) : (
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                  )}
                  
                  <FolderIcon className={`w-4 h-4 shrink-0 ${
                    isSelected 
                      ? 'text-amber-500' 
                      : darkMode ? 'text-zinc-400' : 'text-stone-500'
                  }`} />
                  
                  {editingFolderId === folder.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onBlur={() => saveRename(folder.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, folder.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`text-xs px-1 py-0.5 w-full rounded border outline-none ${
                        darkMode 
                          ? 'bg-zinc-800 border-zinc-750 text-white focus:border-amber-500' 
                          : 'bg-white border-stone-300 text-stone-900 focus:border-stone-500'
                      }`}
                      autoFocus
                    />
                  ) : (
                    <span className="text-xs font-medium truncate py-0.5">
                      {folder.name}
                    </span>
                  )}

                  <span className={`text-[10px] shrink-0 font-normal px-1.5 py-0.2 rounded-full ${
                    darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-stone-200/60 text-stone-600'
                  }`}>
                    {folder.games.length}
                  </span>
                </div>

                {/* Folder Actions */}
                {editingFolderId !== folder.id && (
                  confirmDeleteFolderId === folder.id ? (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folder.id);
                          setConfirmDeleteFolderId(null);
                        }}
                        className="p-1 rounded bg-red-600 hover:bg-red-500 text-white shadow"
                        title="Confirm Delete"
                        id={`btn-confirm-delete-${folder.id}`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteFolderId(null);
                        }}
                        className={`p-1 rounded border ${
                          darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-stone-200 hover:bg-stone-300 text-stone-700 border-stone-300'
                        }`}
                        title="Cancel Delete"
                        id={`btn-cancel-delete-${folder.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Create New Game inside */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateGame(folder.id);
                        }}
                        className={`p-1 rounded border border-transparent transition-colors ${
                          darkMode 
                            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700' 
                            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200 hover:border-stone-300'
                        }`}
                        title="Add Game to Collection"
                        id={`btn-add-game-${folder.id}`}
                      >
                        <FilePlus className="w-3 h-3" />
                      </button>

                      {/* Create New Subcollection inside */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateFolder(undefined, folder.id);
                          setExpandedFolders(prev => ({ ...prev, [folder.id]: true }));
                        }}
                        className={`p-1 rounded border border-transparent transition-colors ${
                          darkMode 
                            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700' 
                            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200 hover:border-stone-300'
                        }`}
                        title="Create Nested Collection"
                        id={`btn-add-subcollection-${folder.id}`}
                      >
                        <FolderPlus className="w-3 h-3" />
                      </button>
                      
                      {/* Rename */}
                      <button
                        onClick={(e) => startRenaming(folder, e)}
                        className={`p-1 rounded border border-transparent transition-colors ${
                          darkMode 
                            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700' 
                            : 'text-stone-500 hover:text-stone-900 hover:bg-stone-200 hover:border-stone-300'
                        }`}
                        title="Rename Collection"
                        id={`btn-rename-folder-${folder.id}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      
                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteFolderId(folder.id);
                        }}
                        className={`p-1 rounded border border-transparent transition-colors hover:text-red-600 dark:hover:text-red-400 ${
                          darkMode ? 'text-zinc-400 hover:bg-red-950/20 hover:border-red-900/30' : 'text-stone-500 hover:bg-red-50 hover:border-red-200'
                        }`}
                        title="Delete Collection"
                        id={`btn-delete-folder-${folder.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                )}
              </div>

              {/* Recursive Children (Nested Folders first, then Games list) */}
              {isExpanded && (
                <div className={`p-1 flex flex-col gap-1 border-t ${
                  darkMode ? 'border-zinc-800/40 bg-zinc-950/25' : 'border-stone-250 bg-stone-50/25'
                }`} id={`folder-content-${folder.id}`}>
                  
                  {/* Subfolders */}
                  {renderFolderTree(folder.id, depth + 1)}

                  {/* Games List */}
                  <div className={`flex flex-col gap-0.5 ${depth > 0 ? 'ml-2' : 'pl-1.5'}`} id={`folder-games-list-${folder.id}`}>
                    {filteredGames.length === 0 && subfolders.length === 0 ? (
                      <p className={`text-[10px] italic py-1.5 pl-4 ${darkMode ? 'text-zinc-650' : 'text-stone-400'}`}>
                        Empty collection
                      </p>
                    ) : (
                      sortedGames.map((game: Game) => {
                        const isGameSelected = activeGameId === game.id;
                        const IconComponent = getGameIcon(game);
                        return (
                          <div
                            key={game.id}
                            onClick={() => onSelectGame(folder.id, game.id)}
                            // Make game row a drag source
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ gameId: game.id, sourceFolderId: folder.id }));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-all group border ${
                              isGameSelected
                                ? darkMode 
                                  ? 'bg-amber-500/10 text-amber-300 font-medium border-amber-500/20' 
                                  : 'bg-stone-200 text-stone-900 font-medium border-stone-300'
                                : darkMode
                                  ? 'hover:bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-transparent'
                                  : 'hover:bg-stone-100 text-stone-600 hover:text-stone-900 border-transparent'
                            }`}
                            id={`game-item-${game.id}`}
                          >
                            <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                              <IconComponent className={`w-3.5 h-3.5 shrink-0 ${
                                isGameSelected 
                                  ? 'text-amber-500' 
                                  : darkMode ? 'text-zinc-500' : 'text-stone-400'
                              }`} />
                              <div className="flex flex-col overflow-hidden w-full text-left">
                                {editingGameId === game.id ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editingGameTitle}
                                    onChange={(e) => setEditingGameTitle(e.target.value)}
                                    onBlur={() => saveRenameGame(game.id)}
                                    onKeyDown={(e) => handleRenameGameKeyDown(e, game.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-[11px] px-1 py-0.5 w-full rounded border outline-none ${
                                      darkMode 
                                        ? 'bg-zinc-800 border-zinc-750 text-white focus:border-amber-500' 
                                        : 'bg-white border-stone-300 text-stone-900 focus:border-stone-500'
                                    }`}
                                  />
                                ) : (
                                  <span className="text-[11px] truncate flex items-center gap-1 font-medium">
                                    {game.starred && <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />}
                                    <span>{game.title}</span>
                                  </span>
                                )}
                                
                                {game.whitePlayer || game.blackPlayer ? (
                                  <span className={`text-[9px] truncate opacity-85 ${
                                    darkMode ? 'text-zinc-500' : 'text-stone-500'
                                  }`}>
                                    {game.whitePlayer || '?'} v {game.blackPlayer || '?'}
                                  </span>
                                ) : (
                                  <span className={`text-[9px] ${
                                    darkMode ? 'text-zinc-650' : 'text-stone-400'
                                  }`}>
                                    {game.date}
                                  </span>
                                )}

                                {/* Little inline tags */}
                                {game.tags && game.tags.length > 0 && !game.initialFen && (
                                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                                    {game.tags.map(tag => (
                                      <span key={tag} className="px-1 py-0.2 text-[8px] font-semibold rounded bg-stone-200/50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 max-w-[60px] truncate">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Actions & Badges */}
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {confirmDeleteGameId === game.id ? (
                                <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onDeleteGame) onDeleteGame(game.id);
                                      setConfirmDeleteGameId(null);
                                    }}
                                    className="p-0.5 rounded bg-red-600 hover:bg-red-500 text-white shadow"
                                    title="Confirm game delete"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteGameId(null);
                                    }}
                                    className={`p-0.5 rounded border ${
                                      darkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-stone-200 border-stone-300 text-stone-700'
                                    }`}
                                    title="Cancel"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Hover Actions */}
                                  <div className="hidden group-hover:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onUpdateGame) onUpdateGame({ ...game, starred: !game.starred });
                                      }}
                                      className={`p-0.5 rounded transition-colors ${
                                        game.starred ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400'
                                      }`}
                                      title={game.starred ? "Unstar game" : "Star game"}
                                    >
                                      <Star className={`w-3 h-3 ${game.starred ? 'fill-amber-500' : ''}`} />
                                    </button>
                                    <button
                                      onClick={(e) => startRenamingGame(game, e)}
                                      className="p-0.5 rounded text-stone-400 hover:text-stone-800 dark:text-zinc-500 dark:hover:text-zinc-200"
                                      title="Rename Game"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteGameId(game.id);
                                      }}
                                      className="p-0.5 rounded text-stone-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                                      title="Delete Game"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Plies Count Badge */}
                                  {!(
                                    game.initialFen || 
                                    game.puzzleStatus || 
                                    (game.themes && game.themes.trim() !== '') ||
                                    folder.name.toLowerCase().includes('puzzle')
                                  ) && (
                                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono group-hover:hidden ${
                                      darkMode ? 'bg-zinc-850 text-zinc-500' : 'bg-stone-100 text-stone-500'
                                    }`}>
                                      {Math.ceil(game.moves.length / 2)}m
                                    </span>
                                  )}
                                  
                                  {/* Result tag */}
                                  {game.result && game.result !== '*' && (
                                    <span className="text-[8px] px-1 font-bold rounded shrink-0 bg-stone-100 dark:bg-zinc-900">
                                      {game.result === '1/2-1/2' ? '½' : game.result}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`w-full h-full flex flex-col border-r shrink-0 transition-all ${
      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-stone-50 border-stone-200 text-stone-800'
    }`} id="sidebar-container">
      
      {/* Header */}
      <div className={`p-4 border-b flex flex-col gap-3 ${
        darkMode ? 'border-zinc-800' : 'border-stone-200'
      }`} id="sidebar-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-amber-950/40 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-sm">Chess Notation</h1>
              <p className={`text-xs ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>Digital Scoresheet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-zinc-900 text-amber-400' : 'hover:bg-stone-200 text-stone-600'
              }`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              id="theme-toggle-btn"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-zinc-900 text-stone-400 hover:text-white' : 'hover:bg-stone-200 text-stone-600 hover:text-stone-900'
                }`}
                title="Collapse Sidebar"
                id="sidebar-collapse-btn"
              >
                <X className="w-4 h-4 text-amber-500" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-2.5 w-4 h-4 ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
            <input
              type="text"
              placeholder="Search games, players, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-md outline-none border transition-colors ${
                darkMode 
                  ? 'bg-zinc-900 border-zinc-800 focus:border-zinc-700 text-zinc-100 placeholder-zinc-500' 
                  : 'bg-white border-stone-200 focus:border-stone-400 text-stone-900 placeholder-stone-400'
              }`}
              id="sidebar-search-input"
            />
          </div>
          <button
            onClick={() => setSortAscending(!sortAscending)}
            className={`p-1.5 rounded-md border transition-colors flex items-center justify-center shrink-0 ${
              darkMode
                ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350 hover:text-white'
                : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-600 hover:text-stone-900'
            }`}
            title={sortAscending ? "Sorted alphabetically. Click to sort backwards" : "Sorted backwards. Click to sort alphabetically"}
            id="sidebar-sort-toggle-btn"
          >
            {sortAscending ? (
              <ArrowUpAZ className="w-4 h-4" />
            ) : (
              <ArrowDownAZ className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Folders & Games List */}
      <div 
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2" 
        id="sidebar-list"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const dataStr = e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            const data = JSON.parse(dataStr);
            
            // If dropping a folder onto the empty area of the sidebar-list, set its parentId to null (root level)
            if (data.dragFolderId && onMoveFolder) {
              onMoveFolder(data.dragFolderId, null);
            }
          } catch (err) {
            console.error(err);
          }
        }}
      >
        
        {/* Create buttons */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => onCreateFolder()}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md border transition-all ${
              darkMode
                ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-200'
                : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-700'
            }`}
            title="Create a folder with current date (Ctrl+Shift+N)"
            id="new-folder-btn"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Folder
          </button>
          
          <button
            onClick={() => {
              if (folders.length === 0) {
                const folderId = onCreateFolder();
                onCreateGame(folderId);
              } else {
                const targetId = activeFolderId || folders[0].id;
                onCreateGame(targetId);
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-all ${
              darkMode
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-900/20'
                : 'bg-stone-800 hover:bg-stone-700 text-white shadow-sm'
            }`}
            title="Create a game in selected folder (Ctrl+N)"
            id="new-game-btn"
          >
            <FilePlus className="w-3.5 h-3.5" />
            New Game
          </button>
        </div>

        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center animate-fade-in">
            <FolderIcon className={`w-8 h-8 mb-2 ${darkMode ? 'text-zinc-700' : 'text-stone-300'}`} />
            <p className={`text-xs font-medium ${darkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
              No collections yet
            </p>
            <p className={`text-[11px] mt-1 ${darkMode ? 'text-zinc-600' : 'text-stone-400'}`}>
              Create a folder to start tracking games.
            </p>
          </div>
        ) : (
          renderFolderTree(null)
        )}
      </div>

      {/* Puzzle Hub Resizable Bottom Panel */}
      {allPuzzles.length > 0 && (
        <div 
          style={{ height: isPuzzleHubExpanded ? `${puzzleHubHeight}px` : '40px' }}
          className={`border-t flex flex-col relative shrink-0 ${
            darkMode 
              ? 'bg-zinc-950 border-zinc-850 text-zinc-200' 
              : 'bg-stone-50 border-stone-200 text-stone-800'
          }`}
          id="puzzle-hub-resizable-section"
        >
          {/* Resize Handle (only visible when expanded) */}
          {isPuzzleHubExpanded && (
            <div 
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center hover:bg-amber-500/20 active:bg-amber-500/40 group z-30"
              title="Drag up/down to resize the puzzle panel"
            >
              {/* Visual double pill/dot handle */}
              <div className="w-8 h-1 rounded-full bg-stone-300 dark:bg-zinc-750 group-hover:bg-amber-500 transition-colors" />
            </div>
          )}

          {/* Main Header */}
          <div 
            onClick={() => setIsPuzzleHubExpanded(!isPuzzleHubExpanded)}
            className={`flex items-center justify-between p-2.5 cursor-pointer select-none transition-colors shrink-0 ${
              isPuzzleHubExpanded ? 'pt-3.5 border-b border-dashed border-stone-200 dark:border-zinc-800' : ''
            } ${
              darkMode ? 'hover:bg-amber-500/5' : 'hover:bg-amber-500/5'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              {isPuzzleHubExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>🧩 Puzzle Collections</span>
              <span className={`text-[10px] shrink-0 font-bold px-1.5 py-0.2 rounded-full ${
                darkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-amber-100 text-amber-800'
              }`}>
                {allPuzzles.length}
              </span>
            </div>
          </div>

          {/* Scrollable Sub Collections Area */}
          {isPuzzleHubExpanded && (
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              
              {/* 1. All Puzzles */}
              <div>
                <div 
                  onClick={() => togglePuzzleSub('all')}
                  className={`flex items-center justify-between px-2 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    darkMode ? 'hover:bg-zinc-900 text-zinc-300' : 'hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {expandedPuzzleSub.all ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>📌 All Puzzles</span>
                  </div>
                  <span className="text-[10px] opacity-70 font-mono">{filteredAllPuzzles.length}</span>
                </div>
                {expandedPuzzleSub.all && (
                  <div className="pl-3.5 pr-1 py-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                    {filteredAllPuzzles.length === 0 ? (
                      <span className="text-[10px] italic text-stone-400 pl-2">No puzzles found</span>
                    ) : (
                      sortedAllPuzzles.map(({ game, folderId }) => renderPuzzleGameItem(game, folderId))
                    )}
                  </div>
                )}
              </div>

              {/* 2. Unsolved Puzzles */}
              <div>
                <div 
                  onClick={() => togglePuzzleSub('unsolved')}
                  className={`flex items-center justify-between px-2 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    darkMode ? 'hover:bg-zinc-900 text-zinc-300' : 'hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {expandedPuzzleSub.unsolved ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>⚪ Unsolved Puzzles</span>
                  </div>
                  <span className="text-[10px] opacity-70 font-mono">{unsolvedPuzzles.length}</span>
                </div>
                {expandedPuzzleSub.unsolved && (
                  <div className="pl-3.5 pr-1 py-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                    {unsolvedPuzzles.length === 0 ? (
                      <span className="text-[10px] italic text-stone-400 pl-2">No unsolved puzzles</span>
                    ) : (
                      sortedUnsolvedPuzzles.map(({ game, folderId }) => renderPuzzleGameItem(game, folderId))
                    )}
                  </div>
                )}
              </div>

              {/* 3. Solved Puzzles */}
              <div>
                <div 
                  onClick={() => togglePuzzleSub('solved')}
                  className={`flex items-center justify-between px-2 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    darkMode ? 'hover:bg-zinc-900 text-zinc-300' : 'hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {expandedPuzzleSub.solved ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>🟢 Solved Puzzles</span>
                  </div>
                  <span className="text-[10px] opacity-70 font-mono">{solvedPuzzles.length}</span>
                </div>
                {expandedPuzzleSub.solved && (
                  <div className="pl-3.5 pr-1 py-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                    {solvedPuzzles.length === 0 ? (
                      <span className="text-[10px] italic text-stone-400 pl-2">No solved puzzles</span>
                    ) : (
                      sortedSolvedPuzzles.map(({ game, folderId }) => renderPuzzleGameItem(game, folderId))
                    )}
                  </div>
                )}
              </div>

              {/* 4. Failed Puzzles */}
              <div>
                <div 
                  onClick={() => togglePuzzleSub('failed')}
                  className={`flex items-center justify-between px-2 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                    darkMode ? 'hover:bg-zinc-900 text-zinc-300' : 'hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {expandedPuzzleSub.failed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>🔴 Failed Puzzles</span>
                  </div>
                  <span className="text-[10px] opacity-70 font-mono">{failedPuzzles.length}</span>
                </div>
                {expandedPuzzleSub.failed && (
                  <div className="pl-3.5 pr-1 py-1 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                    {failedPuzzles.length === 0 ? (
                      <span className="text-[10px] italic text-stone-400 pl-2">No failed puzzles</span>
                    ) : (
                      sortedFailedPuzzles.map(({ game, folderId }) => renderPuzzleGameItem(game, folderId))
                    )}
                  </div>
                )}
              </div>

              {/* 5. Themes (Dynamic Sub-folders) */}
              {Object.keys(themeMap).length > 0 && (
                <div>
                  <div 
                    onClick={() => togglePuzzleSub('themes')}
                    className={`flex items-center justify-between px-2 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      darkMode ? 'hover:bg-zinc-900 text-zinc-300' : 'hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {expandedPuzzleSub.themes ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>🏷️ Puzzle Themes</span>
                    </div>
                    <span className="text-[10px] opacity-70 font-mono">{Object.keys(themeMap).length}</span>
                  </div>
                  {expandedPuzzleSub.themes && (
                    <div className="pl-2 flex flex-col gap-1 mt-0.5 max-h-52 overflow-y-auto">
                      {(() => {
                        const sortedThemeEntries = Object.entries(themeMap).sort(([nameA], [nameB]) => {
                          const comparison = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                          return sortAscending ? comparison : -comparison;
                        });
                        return sortedThemeEntries.map(([themeName, gamesInTheme]) => {
                          const sortedGamesInTheme = [...gamesInTheme].sort((a, b) => {
                            const comparison = a.game.title.localeCompare(b.game.title, undefined, { numeric: true, sensitivity: 'base' });
                            return sortAscending ? comparison : -comparison;
                          });
                          return (
                            <div key={themeName}>
                              <div 
                                onClick={() => toggleTheme(themeName)}
                                className={`flex items-center justify-between px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer ${
                                  darkMode ? 'hover:bg-zinc-850 text-zinc-450 font-medium' : 'hover:bg-stone-50 text-stone-600 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  {expandedThemes[themeName] ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                  <span className="truncate max-w-[120px]">{themeName}</span>
                                </div>
                                <span className="font-mono text-[9px] opacity-60">{gamesInTheme.length}</span>
                              </div>
                              {expandedThemes[themeName] && (
                                <div className="pl-3 flex flex-col gap-0.5 mt-0.5">
                                  {sortedGamesInTheme.map(({ game, folderId }) => renderPuzzleGameItem(game, folderId))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Footer backup / import utility */}
      <div className={`p-3 border-t flex flex-col gap-2 ${
        darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-stone-200 bg-stone-50'
      }`} id="sidebar-footer">
        
        {/* GitHub Gist Cloud Sync button */}
        {onOpenGistSync && (
          <button
            onClick={onOpenGistSync}
            disabled={isBgSyncing}
            title={hasUnsyncedChanges && !isBgSyncing ? "Unsynced changes pending" : undefined}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold rounded-md border transition-all ${
              darkMode
                ? isBgSyncing
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-400 opacity-70'
                  : 'bg-amber-600/15 border-amber-600/35 hover:bg-amber-600/25 text-amber-300'
                : isBgSyncing
                  ? 'bg-stone-100 border-stone-200 text-stone-400 opacity-75'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800'
            }`}
            id="btn-sidebar-gist-sync"
          >
            <Cloud className={`w-3.5 h-3.5 ${isBgSyncing ? 'animate-spin text-amber-500' : ''}`} />
            <span>{isBgSyncing ? 'Syncing...' : 'Cloud Gist Sync'}</span>
            
            {hasUnsyncedChanges && !isBgSyncing && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 ml-0.5" />
            )}
          </button>
        )}

        {/* Bulk PGN Import button */}
        <button
          onClick={onOpenImport}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md border transition-all ${
            darkMode
              ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-amber-400'
              : 'bg-stone-100 border-stone-200 hover:bg-stone-200 text-stone-800'
          }`}
          id="btn-sidebar-import-pgn"
        >
          <Upload className="w-3.5 h-3.5" />
          Import PGN / Games
        </button>

        {/* Backup & Restore buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onBackup}
            className={`flex items-center justify-center gap-1 py-1 px-2 text-[10px] font-medium rounded border transition-colors ${
              darkMode
                ? 'bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800/80 text-zinc-300'
                : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-600'
            }`}
            title="Backup all data to a JSON file"
            id="btn-sidebar-backup"
          >
            <Download className="w-3 h-3" />
            Backup All
          </button>
          
          <button
            onClick={handleRestoreClick}
            className={`flex items-center justify-center gap-1 py-1 px-2 text-[10px] font-medium rounded border transition-colors ${
              darkMode
                ? 'bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800/80 text-zinc-300'
                : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-600'
            }`}
            title="Restore app data from a backup JSON file"
            id="btn-sidebar-restore"
          >
            <Upload className="w-3 h-3" />
            Restore All
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Hotkeys indicator */}
        <div className={`text-[10px] flex items-start gap-1 p-1.5 rounded ${
          darkMode ? 'bg-zinc-900/40 text-zinc-500' : 'bg-stone-100 text-stone-500'
        }`} id="sidebar-hotkey-quickinfo">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            Press <kbd className="font-sans font-bold">Ctrl + H</kbd> for shortcut keys cheatsheet.
          </span>
        </div>
      </div>
    </div>
  );
}
