import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Trash2, 
  Settings, 
  ChevronDown, 
  ChevronUp, 
  User, 
  MapPin, 
  Trophy, 
  Calendar, 
  BookOpen, 
  Undo, 
  Redo,
  Plus, 
  X,
  FileText,
  CornerDownLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Check,
  Copy,
  Save,
  Bookmark,
  Award,
  Cpu,
  Zap,
  Palette,
  Tag,
  Star,
  Sparkles,
  MessageSquarePlus,
  MessageSquare,
  Edit,
  CheckSquare
} from 'lucide-react';
import { Chess } from 'chess.js';
import { Game, MovePly, AnalysisReport } from '../types';
import { exportToPGN, parsePGN } from '../utils/pgn';
import { Chessground } from 'chessground';
import { Api } from 'chessground/api';
import { Config } from 'chessground/config';

import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

// Helper to extract legal moves for Chessground
function getDests(chess: Chess): any {
  const dests = new Map<string, string[]>();
  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    if (!dests.has(m.from)) {
      dests.set(m.from, []);
    }
    dests.get(m.from)!.push(m.to);
  }
  return dests;
}

interface GameEditorProps {
  game: Game;
  folderName: string;
  onUpdateGame: (updatedGame: Game) => void;
  onDeleteGame: (id: string) => void;
  darkMode: boolean;
}

const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
};

// Helper to compute chess.js board state at any ply index
function getBoardAtPly(moves: MovePly[], plyIndex: number, startingColor: 'white' | 'black', initialFen?: string) {
  const chess = new Chess();
  if (initialFen) {
    try {
      chess.load(initialFen);
    } catch (e) {
      // fallback
    }
  } else if (startingColor === 'black') {
    try {
      chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
    } catch (e) {
      // safe fallback
    }
  }

  const pliesPlayed = moves.slice(0, plyIndex);
  for (const ply of pliesPlayed) {
    try {
      let result = null;
      try {
        result = chess.move(ply.move);
      } catch (e) {
        // try fallback
      }

      if (!result) {
        const cleanMove = ply.move.replace(/[!?]/g, '');
        const legalMoves = chess.moves();
        const matched = legalMoves.find(m => {
          const cleanL = m.replace(/[+#x-]/g, '').toLowerCase();
          const cleanP = cleanMove.replace(/[+#x-]/g, '').toLowerCase();
          return cleanL === cleanP || m.toLowerCase() === cleanMove.toLowerCase();
        });
        if (matched) {
          chess.move(matched);
        } else {
          chess.move(cleanMove);
        }
      }
    } catch (e) {
      // Skip invalid/incomplete moves gracefully
    }
  }
  return chess.board();
}

// Helper to compute net material balance (White sum - Black sum)
function getMaterialBalance(board: any) {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let whiteSum = 0;
  let blackSum = 0;
  
  for (const row of board) {
    if (!row) continue;
    for (const square of row) {
      if (square) {
        const val = values[square.type] || 0;
        if (square.color === 'w') {
          whiteSum += val;
        } else {
          blackSum += val;
        }
      }
    }
  }

  const diff = whiteSum - blackSum;
  return { whiteSum, blackSum, diff };
}

// Helper to compute FEN at any ply index
function getFenAtPly(moves: MovePly[], plyIndex: number, startingColor: 'white' | 'black', initialFen?: string): string {
  const chess = new Chess();
  if (initialFen) {
    try {
      chess.load(initialFen);
    } catch (e) {
      // fallback
    }
  } else if (startingColor === 'black') {
    try {
      chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
    } catch (e) {
      // safe fallback
    }
  }

  const pliesPlayed = moves.slice(0, plyIndex);
  for (const ply of pliesPlayed) {
    try {
      let result = null;
      try {
        result = chess.move(ply.move);
      } catch (e) {
        // try fallback
      }

      if (!result) {
        const cleanMove = ply.move.replace(/[!?]/g, '');
        const legalMoves = chess.moves();
        const matched = legalMoves.find(m => {
          const cleanL = m.replace(/[+#x-]/g, '').toLowerCase();
          const cleanP = cleanMove.replace(/[+#x-]/g, '').toLowerCase();
          return cleanL === cleanP || m.toLowerCase() === cleanMove.toLowerCase();
        });
        if (matched) {
          chess.move(matched);
        } else {
          chess.move(cleanMove);
        }
      }
    } catch (e) {
      // Skip invalid/incomplete moves gracefully
    }
  }
  return chess.fen();
}

const SAN_REGEX = /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBN])?|O-O-O|O-O|0-0-0|0-0)[+#]?[!?]*$/i;

function checkPgnValidity(moves: MovePly[], startingColor: 'white' | 'black', initialFen?: string): boolean {
  const chess = new Chess();
  if (initialFen) {
    try {
      chess.load(initialFen);
    } catch (e) {
      return false;
    }
  } else if (startingColor === 'black') {
    try {
      chess.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
    } catch (e) {
      return false;
    }
  }

  for (const ply of moves) {
    try {
      let result = null;
      try {
        result = chess.move(ply.move);
      } catch (e) {
        // try fallback
      }

      if (!result) {
        const cleanMove = ply.move.replace(/[!?]/g, '');
        const legalMoves = chess.moves();
        const matched = legalMoves.find(m => {
          const cleanL = m.replace(/[+#x-]/g, '').toLowerCase();
          const cleanP = cleanMove.replace(/[+#x-]/g, '').toLowerCase();
          return cleanL === cleanP || m.toLowerCase() === cleanMove.toLowerCase();
        });

        if (matched) {
          result = chess.move(matched);
        } else {
          result = chess.move(cleanMove);
        }
      }

      if (!result) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

function fixNotationCapitalization(moveStr: string): string {
  let move = moveStr.trim();
  if (!move) return move;

  const lowerMove = move.toLowerCase();
  if (lowerMove === 'o-o') return 'O-O';
  if (lowerMove === 'o-o-o') return 'O-O-O';
  if (move === '0-0') return 'O-O';
  if (move === '0-0-0') return 'O-O-O';

  // Handle promotion capitalization, e.g. e8=q -> e8=Q
  if (move.includes('=')) {
    const parts = move.split('=');
    if (parts[1]) {
      parts[1] = parts[1].toUpperCase();
    }
    move = parts.join('=');
  }

  const firstChar = move[0].toLowerCase();
  if (['k', 'q', 'r', 'n', 'b'].includes(firstChar)) {
    let isPiece = true;
    if (firstChar === 'b') {
      const secondChar = move[1]?.toLowerCase();
      if (secondChar && /[1-8]/.test(secondChar)) {
        isPiece = false;
      } else if (secondChar === 'x') {
        const thirdChar = move[2]?.toLowerCase();
        if (thirdChar && /[a-h]/.test(thirdChar)) {
          isPiece = false;
        }
      }
    }

    if (isPiece) {
      move = firstChar.toUpperCase() + move.slice(1);
    }
  }

  return move;
}

function validateMoveInput(rawMove: string, currentFen: string, isFreestyle: boolean = false): { isValid: boolean; error?: string; fixedMove?: string } {
  const clean = rawMove.trim();
  if (!clean) {
    return { isValid: false, error: 'Move cannot be empty.' };
  }

  if (!SAN_REGEX.test(clean)) {
    return { isValid: false, error: `"${clean}" is not a valid chess move notation.` };
  }

  const fixedMove = fixNotationCapitalization(clean);

  if (isFreestyle) {
    return { isValid: true, fixedMove };
  }

  const tempChess = new Chess();
  try {
    tempChess.load(currentFen);
  } catch (e) {
    return { isValid: true, fixedMove };
  }

  const legalMoves = tempChess.moves();
  const matchedLegalMove = legalMoves.find(
    m => m.toLowerCase() === clean.toLowerCase() || m.toLowerCase() === fixedMove.toLowerCase()
  );

  if (matchedLegalMove) {
    return { isValid: true, fixedMove: matchedLegalMove };
  }

  try {
    const moveResult = tempChess.move(fixedMove);
    if (moveResult) {
      return { isValid: true, fixedMove: moveResult.san };
    }
  } catch (err) {
    // fall through
  }

  return {
    isValid: false,
    error: `"${fixedMove}" is not a legal move in this position.`
  };
}

export default function GameEditor({
  game,
  folderName,
  onUpdateGame,
  onDeleteGame,
  darkMode
}: GameEditorProps) {
  const [moveInput, setMoveInput] = useState('');
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [tempInputText, setTempInputText] = useState<string>('');
  const [showMetadata, setShowMetadata] = useState(false);
  const [hideRightSidebar, setHideRightSidebar] = useState(false);

  // Board theme settings
  const [boardTheme, setBoardTheme] = useState<'emerald' | 'wood' | 'blue' | 'charcoal' | 'purple'>(() => {
    return (localStorage.getItem('board_theme') as any) || 'emerald';
  });
  const [pieceTheme, setPieceTheme] = useState<'classic' | 'alpha' | 'merida' | 'cardinal' | 'governor' | 'dubrovny'>(() => {
    const saved = localStorage.getItem('piece_theme');
    if (saved === 'classic' || saved === 'alpha' || saved === 'merida' || saved === 'cardinal' || saved === 'governor' || saved === 'dubrovny') {
      return saved as any;
    }
    return 'classic';
  });
  const [showThemeSettings, setShowThemeSettings] = useState(false);

  // Raw PGN editing state
  const [rawPgnInput, setRawPgnInput] = useState('');
  const [pgnInputError, setPgnInputError] = useState<string | null>(null);
  const [pgnInputSuccess, setPgnInputSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (showMetadata) {
      setRawPgnInput(exportToPGN(game, folderName));
      setPgnInputError(null);
      setPgnInputSuccess(false);
    }
  }, [showMetadata, game.id]);

  // Export Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedPgnText, setExportedPgnText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // Variations & Active Navigation line state
  const [activeLine, setActiveLine] = useState<MovePly[]>([]);
  
  // Inline move editing states
  const [editingPlyIndex, setEditingPlyIndex] = useState<string | null>(null);
  const [editingMoveValue, setEditingMoveValue] = useState('');
  const [editingCommentPlyId, setEditingCommentPlyId] = useState<string | null>(null);
  const [editingCommentValue, setEditingCommentValue] = useState('');
  const [confirmTruncateIndex, setConfirmTruncateIndex] = useState<number | null>(null);

  // Right Sidebar width and collapse states
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('right-sidebar-width');
    return saved ? parseInt(saved, 10) : 384;
  });
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('right-sidebar-collapsed');
    return saved === 'true';
  });

  const handleRightResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(260, Math.min(650, startWidth - delta));
      setRightSidebarWidth(newWidth);
      localStorage.setItem('right-sidebar-width', String(newWidth));
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  // Helper functions for tree variations and shapes
  const stripShapesFromComment = (comment: string): string => {
    if (!comment) return '';
    return comment
      .replace(/\[%cal\s+[^\]]+\]/g, '')
      .replace(/\[%cld\s+[^\]]+\]/g, '')
      .trim();
  };

  const mergeCommentAndShapes = (newText: string, oldComment: string | undefined): string => {
    if (!oldComment) return newText.trim();
    const calRegex = /\[%cal\s+([^\]]+)\]/;
    const cldRegex = /\[%cld\s+([^\]]+)\]/;
    const calMatch = oldComment.match(calRegex);
    const cldMatch = oldComment.match(cldRegex);
    let merged = newText.trim();
    if (calMatch) merged += ` ${calMatch[0]}`;
    if (cldMatch) merged += ` ${cldMatch[0]}`;
    return merged.trim();
  };

  const findLineForPly = (
    plies: MovePly[],
    targetId: string,
    currentPrefix: MovePly[] = []
  ): { prefix: MovePly[]; continuation: MovePly[] } | null => {
    for (let i = 0; i < plies.length; i++) {
      const ply = plies[i];
      if (ply.id === targetId) {
        return {
          prefix: [...currentPrefix, ...plies.slice(0, i)],
          continuation: plies.slice(i)
        };
      }
      if (ply.variations) {
        for (const variation of ply.variations) {
          const found = findLineForPly(variation, targetId, [...currentPrefix, ...plies.slice(0, i)]);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const findPlyPath = (
    plies: MovePly[],
    targetId: string,
    parentPly: MovePly | null = null,
    currentLine: MovePly[] = []
  ): { line: MovePly[]; index: number; parentPly: MovePly | null } | null => {
    for (let i = 0; i < plies.length; i++) {
      const ply = plies[i];
      if (ply.id === targetId) {
        return {
          line: plies,
          index: i,
          parentPly
        };
      }
      if (ply.variations) {
        for (const variation of ply.variations) {
          const found = findPlyPath(variation, targetId, ply, variation);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const getShapesFromComment = (comment: string): { orig: string; dest?: string; brush: string }[] => {
    const shapes: { orig: string; dest?: string; brush: string }[] = [];
    if (!comment) return shapes;

    const calRegex = /\[%cal\s+([^\]]+)\]/g;
    let match;
    while ((match = calRegex.exec(comment)) !== null) {
      const items = match[1].split(',');
      for (const item of items) {
        const trimmed = item.trim();
        if (trimmed.length === 5) {
          const colorChar = trimmed[0];
          const orig = trimmed.substring(1, 3);
          const dest = trimmed.substring(3, 5);
          let brush = 'green';
          if (colorChar === 'R') brush = 'red';
          else if (colorChar === 'B') brush = 'blue';
          else if (colorChar === 'Y') brush = 'yellow';
          shapes.push({ orig, dest, brush });
        }
      }
    }

    const cldRegex = /\[%cld\s+([^\]]+)\]/g;
    while ((match = cldRegex.exec(comment)) !== null) {
      const items = match[1].split(',');
      for (const item of items) {
        const trimmed = item.trim();
        if (trimmed.length === 3) {
          const colorChar = trimmed[0];
          const orig = trimmed.substring(1, 3);
          let brush = 'green';
          if (colorChar === 'R') brush = 'red';
          else if (colorChar === 'B') brush = 'blue';
          else if (colorChar === 'Y') brush = 'yellow';
          shapes.push({ orig, brush });
        }
      }
    }

    return shapes;
  };

  const insertMoveIntoTree = (
    plies: MovePly[],
    parentPlyId: string | null,
    newPly: MovePly
  ): { updatedPlies: MovePly[]; inserted: boolean } => {
    if (parentPlyId === null) {
      if (plies.length === 0) {
        return { updatedPlies: [newPly], inserted: true };
      }
      const firstPly = plies[0];
      if (firstPly.move === newPly.move) {
        return { updatedPlies: plies, inserted: false };
      }
      const updatedFirst = { ...firstPly };
      if (!updatedFirst.variations) updatedFirst.variations = [];
      const exists = updatedFirst.variations.some(v => v[0] && v[0].move === newPly.move);
      if (!exists) {
        updatedFirst.variations.push([newPly]);
      }
      const copy = [...plies];
      copy[0] = updatedFirst;
      return { updatedPlies: copy, inserted: true };
    }

    const parentIdx = plies.findIndex(p => p.id === parentPlyId);
    if (parentIdx !== -1) {
      if (parentIdx === plies.length - 1) {
        return { updatedPlies: [...plies, newPly], inserted: true };
      } else {
        const sibling = plies[parentIdx + 1];
        if (sibling.move === newPly.move) {
          return { updatedPlies: plies, inserted: false };
        }
        const parentPly = plies[parentIdx];
        const updatedParent = { ...parentPly };
        if (!updatedParent.variations) updatedParent.variations = [];
        const exists = updatedParent.variations.some(v => v[0] && v[0].move === newPly.move);
        if (!exists) {
          updatedParent.variations.push([newPly]);
        }
        const copy = [...plies];
        copy[parentIdx] = updatedParent;
        return { updatedPlies: copy, inserted: true };
      }
    }

    let inserted = false;
    const updatedPlies = plies.map(ply => {
      if (inserted) return ply;
      if (ply.variations) {
        let varInserted = false;
        const updatedVars = ply.variations.map(v => {
          if (varInserted) return v;
          const res = insertMoveIntoTree(v, parentPlyId, newPly);
          if (res.inserted) {
            varInserted = true;
            inserted = true;
            return res.updatedPlies;
          }
          return v;
        });
        if (varInserted) {
          return { ...ply, variations: updatedVars };
        }
      }
      return ply;
    });

    return { updatedPlies, inserted };
  };

  const updateCommentInTree = (
    plies: MovePly[],
    targetId: string,
    comment: string | undefined
  ): MovePly[] => {
    return plies.map(ply => {
      if (ply.id === targetId) {
        return { ...ply, comment };
      }
      if (ply.variations) {
        return {
          ...ply,
          variations: ply.variations.map(v => updateCommentInTree(v, targetId, comment))
        };
      }
      return ply;
    });
  };

  const deletePlyFromTree = (plies: MovePly[], targetId: string): MovePly[] => {
    const idx = plies.findIndex(p => p.id === targetId);
    if (idx !== -1) {
      return plies.slice(0, idx);
    }
    return plies.map(p => {
      if (p.variations) {
        return {
          ...p,
          variations: p.variations
            .map(v => deletePlyFromTree(v, targetId))
            .filter(v => v.length > 0)
        };
      }
      return p;
    });
  };

  const handleSavePlyEditInPlace = (plyId: string, customVal?: string) => {
    const cleanMoveValue = (customVal !== undefined ? customVal : editingMoveValue).trim();
    if (cleanMoveValue === '') {
      setEditingPlyIndex(null);
      return;
    }

    const lineInfo = findLineForPly(game.moves, plyId);
    if (!lineInfo) return;

    const fenBefore = getFenAtPly(
      [...lineInfo.prefix, ...lineInfo.continuation],
      lineInfo.prefix.length,
      game.startingColor,
      game.initialFen
    );

    const validation = validateMoveInput(cleanMoveValue, fenBefore, freestyleMode);
    if (!validation.isValid) {
      setEditMoveValidationError(validation.error || 'Invalid move.');
      return;
    }

    // Record history
    setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
    setRedoHistory([]);

    const updateMoveInTree = (plies: MovePly[]): MovePly[] => {
      return plies.map(p => {
        if (p.id === plyId) {
          return { ...p, move: validation.fixedMove! };
        }
        if (p.variations) {
          return {
            ...p,
            variations: p.variations.map(v => updateMoveInTree(v))
          };
        }
        return p;
      });
    };

    const updatedPlies = updateMoveInTree(game.moves);
    onUpdateGame({ ...game, moves: updatedPlies });
    setEditingPlyIndex(null);
    setEditMoveValidationError(null);

    // Sync activeLine
    const activeRes = findLineForPly(updatedPlies, plyId);
    if (activeRes) {
      const newLine = [...activeRes.prefix, ...activeRes.continuation];
      setActiveLine(newLine);
    }
  };

  const handleSaveCommentInPlace = (plyId: string, customVal?: string) => {
    const valToSave = customVal !== undefined ? customVal : editingCommentValue;
    const lineInfo = findLineForPly(game.moves, plyId);
    const targetPly = lineInfo?.continuation[0];
    const oldComment = targetPly?.comment;

    // Record history
    setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
    setRedoHistory([]);

    const merged = mergeCommentAndShapes(valToSave, oldComment);
    const updatedPlies = updateCommentInTree(game.moves, plyId, merged === '' ? undefined : merged);

    onUpdateGame({ ...game, moves: updatedPlies });
    setEditingCommentPlyId(null);

    // Sync activeLine
    const activeRes = findLineForPly(updatedPlies, plyId);
    if (activeRes) {
      const newLine = [...activeRes.prefix, ...activeRes.continuation];
      setActiveLine(newLine);
    }
  };

  const handleDeletePlyInPlace = (plyId: string) => {
    // Record history
    setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
    setRedoHistory([]);

    // Find the previous ply to set preview position after deletion
    const lineInfo = findLineForPly(game.moves, plyId);
    const updatedPlies = deletePlyFromTree(game.moves, plyId);
    onUpdateGame({ ...game, moves: updatedPlies });

    setEditingPlyIndex(null);
    setEditingCommentPlyId(null);

    if (lineInfo) {
      setActiveLine(lineInfo.prefix);
      setCurrentPlyIndex(Math.max(0, lineInfo.prefix.length));
    } else {
      setActiveLine(updatedPlies);
      setCurrentPlyIndex(updatedPlies.length);
    }
  };

  // Board preview states
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [undoneMoves, setUndoneMoves] = useState<MovePly[]>([]);
  const [undoHistory, setUndoHistory] = useState<{ moves: MovePly[]; activeLine: MovePly[]; currentPlyIndex: number }[]>([]);
  const [redoHistory, setRedoHistory] = useState<{ moves: MovePly[]; activeLine: MovePly[]; currentPlyIndex: number }[]>([]);

  // Tab state for Notes Sidebar
  const [activeTab, setActiveTab] = useState<'board' | 'analysis' | 'notes'>('notes');

  // Freestyle Note Taking Mode state (defaults to true)
  const [freestyleMode, setFreestyleMode] = useState<boolean>(true);

  // --- PUZZLE SOLVING STATES ---
  const isPuzzle = !!game.initialFen;
  const [puzzleEditMode, setPuzzleEditMode] = useState<boolean>(false);
  const isPuzzleActive = isPuzzle && !puzzleEditMode;
  const [puzzleStep, setPuzzleStep] = useState<number>(0);
  const [puzzleState, setPuzzleState] = useState<'solving' | 'correct-move' | 'failed' | 'solved'>('solving');
  const [showScoresheetForce, setShowScoresheetForce] = useState<boolean>(false);
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [isOpponentThinking, setIsOpponentThinking] = useState<boolean>(false);
  const [puzzleFen, setPuzzleFen] = useState<string>('');

  const [boardElement, setBoardElement] = useState<HTMLDivElement | null>(null);
  const cgInstanceRef = useRef<Api | null>(null);
  const handleBoardMoveRef = useRef<any>(null);

  const [previewBoardElement, setPreviewBoardElement] = useState<HTMLDivElement | null>(null);
  const previewCgRef = useRef<Api | null>(null);
  const previewHandleBoardMoveRef = useRef<any>(null);

  const resetPuzzle = () => {
    const chess = new Chess();
    if (game.initialFen) {
      try {
        chess.load(game.initialFen);
      } catch (e) {
        console.error("Failed to load initial FEN", e);
      }
    }
    const initFen = chess.fen();
    setPuzzleFen(initFen);
    setPuzzleStep(0);
    setPuzzleState('solving');
    setShowScoresheetForce(false);
    setMistakeCount(0);
    setIsOpponentThinking(false);

    // Update Chessground if it exists
    if (cgInstanceRef.current) {
      cgInstanceRef.current.set({
        fen: initFen,
        turnColor: chess.turn() === 'b' ? 'black' : 'white',
        lastMove: undefined,
        movable: {
          color: chess.turn() === 'b' ? 'black' : 'white',
          dests: getDests(chess) as any
        },
        shapes: []
      });
    }
  };

  const showHint = () => {
    if (!cgInstanceRef.current || !puzzleFen) return;

    const correctMove = game.moves[puzzleStep];
    if (!correctMove) return;

    const temp = new Chess(puzzleFen);
    try {
      const m = temp.move(correctMove.move);
      if (m) {
        cgInstanceRef.current.setShapes([
          {
            orig: m.from as any,
            dest: m.to as any,
            brush: 'green'
          }
        ]);
        setPuzzleState('solving');
      }
    } catch (e) {
      console.error("Failed to calculate hint:", e);
    }
  };

  // Define the board move handler ref
  useEffect(() => {
    handleBoardMoveRef.current = (from: string, to: string) => {
      if (!puzzleFen) return;

      const tempChess = new Chess(puzzleFen);
      let moveObj = null;
      try {
        moveObj = tempChess.move({ from, to, promotion: 'q' });
      } catch (e) {
        // illegal move
      }

      if (!moveObj) {
        if (cgInstanceRef.current) {
          const resetChess = new Chess(puzzleFen);
          cgInstanceRef.current.set({
            fen: puzzleFen,
            turnColor: resetChess.turn() === 'b' ? 'black' : 'white',
            movable: {
              color: resetChess.turn() === 'b' ? 'black' : 'white',
              dests: getDests(resetChess) as any
            }
          });
        }
        return;
      }

      const correctMove = game.moves[puzzleStep];
      if (!correctMove) return;

      const verificationChess = new Chess(puzzleFen);
      let correctMoveObj = null;
      try {
        correctMoveObj = verificationChess.move(correctMove.move);
      } catch (e) {
        // cannot play
      }

      const isMoveCorrect = correctMoveObj && correctMoveObj.from === from && correctMoveObj.to === to;

      if (isMoveCorrect) {
        const fenAfterUserMove = verificationChess.fen();
        setPuzzleFen(fenAfterUserMove);
        
        if (cgInstanceRef.current) {
          cgInstanceRef.current.setShapes([]);
        }

        const nextStep = puzzleStep + 1;
        setPuzzleStep(nextStep);

        if (nextStep >= game.moves.length) {
          setPuzzleState('solved');
          // Only auto-mark as solved if they made zero mistakes on this attempt
          if (mistakeCount === 0) {
            onUpdateGame({ ...game, puzzleStatus: 'solved' });
          } else {
            onUpdateGame({ ...game, puzzleStatus: 'failed' });
          }
          if (cgInstanceRef.current) {
            cgInstanceRef.current.set({
              fen: fenAfterUserMove,
              movable: { color: undefined, dests: new Map() }
            });
          }
        } else {
          setPuzzleState('correct-move');
          setIsOpponentThinking(true);
          
          if (cgInstanceRef.current) {
            cgInstanceRef.current.set({ movable: { color: undefined } });
          }

          setTimeout(() => {
            const oppMove = game.moves[nextStep];
            if (oppMove) {
              try {
                const opponentChess = new Chess(fenAfterUserMove);
                const playedOppMove = opponentChess.move(oppMove.move);
                if (playedOppMove) {
                  const fenAfterOppMove = opponentChess.fen();
                  setPuzzleFen(fenAfterOppMove);

                  const stepAfterOpp = nextStep + 1;
                  setPuzzleStep(stepAfterOpp);
                  setIsOpponentThinking(false);

                  if (stepAfterOpp >= game.moves.length) {
                    setPuzzleState('solved');
                    // Only auto-mark as solved if they made zero mistakes on this attempt
                    if (mistakeCount === 0) {
                      onUpdateGame({ ...game, puzzleStatus: 'solved' });
                    } else {
                      onUpdateGame({ ...game, puzzleStatus: 'failed' });
                    }
                    if (cgInstanceRef.current) {
                      cgInstanceRef.current.set({
                        fen: fenAfterOppMove,
                        movable: { color: undefined, dests: new Map() }
                      });
                    }
                  } else {
                    setPuzzleState('solving');
                    if (cgInstanceRef.current) {
                      cgInstanceRef.current.set({
                        fen: fenAfterOppMove,
                        turnColor: opponentChess.turn() === 'b' ? 'black' : 'white',
                        lastMove: [playedOppMove.from, playedOppMove.to],
                        movable: {
                          color: opponentChess.turn() === 'b' ? 'black' : 'white',
                          dests: getDests(opponentChess) as any
                        }
                      });
                    }
                  }
                }
              } catch (err) {
                console.error("Failed to play opponent move:", err);
              }
            }
          }, 800);
        }
      } else {
        const nextMistakes = mistakeCount + 1;
        setMistakeCount(nextMistakes);
        setPuzzleState('failed');
        onUpdateGame({ ...game, puzzleStatus: 'failed' });

        if (cgInstanceRef.current) {
          const resetChess = new Chess(puzzleFen);
          cgInstanceRef.current.set({
            fen: puzzleFen,
            turnColor: resetChess.turn() === 'b' ? 'black' : 'white',
            movable: {
              color: resetChess.turn() === 'b' ? 'black' : 'white',
              dests: getDests(resetChess) as any
            }
          });
        }
      }
    };
  });

  // Initialize and update Chessground
  useEffect(() => {
    if (!isPuzzleActive || !boardElement) return;

    const chess = new Chess();
    if (game.initialFen) {
      try {
        chess.load(game.initialFen);
      } catch (e) {
        console.error("Error loading FEN on init", e);
      }
    }
    const initFen = chess.fen();
    setPuzzleFen(initFen);
    setPuzzleStep(0);
    setPuzzleState('solving');
    setShowScoresheetForce(false);
    setMistakeCount(0);
    setIsOpponentThinking(false);

    const startingTurn = chess.turn();
    const initialFlipped = startingTurn === 'b';
    setIsFlipped(initialFlipped);
    const orientation = initialFlipped ? 'black' : 'white';

    const config: Config = {
      fen: initFen,
      orientation: orientation,
      turnColor: startingTurn === 'b' ? 'black' : 'white',
      coordinates: true,
      animation: {
        enabled: true,
        duration: 200
      },
      movable: {
        free: false,
        color: startingTurn === 'b' ? 'black' : 'white',
        dests: getDests(chess) as any,
        events: {
          after: (from, to) => {
            if (handleBoardMoveRef.current) {
              handleBoardMoveRef.current(from, to);
            }
          }
        }
      },
      draggable: {
        enabled: true,
        showGhost: true
      },
      selectable: {
        enabled: true
      },
      highlight: {
        lastMove: true,
        check: true
      }
    };

    const cg = Chessground(boardElement, config);
    cgInstanceRef.current = cg;

    return () => {
      if (cgInstanceRef.current) {
        cgInstanceRef.current.destroy();
        cgInstanceRef.current = null;
      }
    };
  }, [game.id, isPuzzleActive, boardElement]);

  // Sync puzzle board orientation dynamically when isFlipped changes
  useEffect(() => {
    if (cgInstanceRef.current) {
      cgInstanceRef.current.set({ orientation: isFlipped ? 'black' : 'white' });
    }
  }, [isFlipped]);

  // Keep previewHandleBoardMoveRef in sync with latest states to prevent stale closure issues
  useEffect(() => {
    previewHandleBoardMoveRef.current = (from: any, to: any) => {
      const currentFen = getFenAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);
      const chessAtCurrent = new Chess(currentFen);
      let movePlayed = null;
      try {
        movePlayed = chessAtCurrent.move({ from, to, promotion: 'q' });
      } catch (e) {
        // illegal move
      }

      if (!movePlayed && !freestyleMode) {
        if (previewCgRef.current) {
          previewCgRef.current.set({ fen: currentFen });
        }
        return;
      }

      const addedMoveSan = movePlayed ? movePlayed.san : `${from}${to}`;

      const newPly: MovePly = {
        id: Math.random().toString(36).substring(2, 11),
        move: addedMoveSan,
      };

      const parentPlyId = currentPlyIndex > 0 ? activeLine[currentPlyIndex - 1]?.id : null;
      setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
      setRedoHistory([]);
      const res = insertMoveIntoTree(game.moves, parentPlyId, newPly);

      const updatedGame: Game = {
        ...game,
        moves: res.updatedPlies
      };

      onUpdateGame(updatedGame);
      setUndoneMoves([]); // Clear redo stack on manual entry
      setMoveValidationError(null);

      // Reconstruct activeLine and set ply index to the played move
      const activeRes = findLineForPly(res.updatedPlies, newPly.id);
      if (activeRes) {
        const newLine = [...activeRes.prefix, ...activeRes.continuation];
        setActiveLine(newLine);
        setCurrentPlyIndex(activeRes.prefix.length + 1);
      }
    };
  }, [activeLine, currentPlyIndex, game, freestyleMode, onUpdateGame]);

  // Initialize standard preview Chessground board only when necessary
  useEffect(() => {
    if (isPuzzleActive || activeTab !== 'board' || !previewBoardElement) {
      if (previewCgRef.current) {
        previewCgRef.current.destroy();
        previewCgRef.current = null;
      }
      return;
    }

    if (!previewCgRef.current) {
      const currentFen = getFenAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);
      const chess = new Chess(currentFen);
      const startingTurn = chess.turn();

      const currentPly = activeLine[currentPlyIndex - 1];
      const currentComment = currentPly?.comment || '';
      const shapes = getShapesFromComment(currentComment);

      const config: Config = {
        fen: currentFen,
        orientation: isFlipped ? 'black' : 'white',
        turnColor: startingTurn === 'b' ? 'black' : 'white',
        coordinates: true,
        animation: {
          enabled: true,
          duration: 200
        },
        movable: {
          free: freestyleMode,
          color: freestyleMode ? 'both' : (startingTurn === 'b' ? 'black' : 'white'),
          dests: freestyleMode ? undefined : getDests(chess) as any,
          events: {
            after: (from, to) => {
              if (previewHandleBoardMoveRef.current) {
                previewHandleBoardMoveRef.current(from, to);
              }
            }
          }
        },
        draggable: {
          enabled: true,
          showGhost: true
        },
        selectable: {
          enabled: true
        },
        highlight: {
          lastMove: true,
          check: true
        },
        drawable: {
          shapes: shapes as any
        }
      };

      previewCgRef.current = Chessground(previewBoardElement, config);
    }

    return () => {
      if (previewCgRef.current) {
        previewCgRef.current.destroy();
        previewCgRef.current = null;
      }
    };
  }, [activeTab, isPuzzleActive, previewBoardElement]);

  // Update existing standard preview Chessground board dynamically with piece animations
  useEffect(() => {
    if (!previewCgRef.current || isPuzzleActive || activeTab !== 'board') return;

    const currentFen = getFenAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);
    const chess = new Chess(currentFen);
    const startingTurn = chess.turn();

    const currentPly = activeLine[currentPlyIndex - 1];
    const currentComment = currentPly?.comment || '';
    const shapes = getShapesFromComment(currentComment);

    const config: Config = {
      fen: currentFen,
      orientation: isFlipped ? 'black' : 'white',
      turnColor: startingTurn === 'b' ? 'black' : 'white',
      coordinates: true,
      animation: {
        enabled: true,
        duration: 200
      },
      movable: {
        free: freestyleMode,
        color: freestyleMode ? 'both' : (startingTurn === 'b' ? 'black' : 'white'),
        dests: freestyleMode ? undefined : getDests(chess) as any,
        events: {
          after: (from, to) => {
            if (previewHandleBoardMoveRef.current) {
              previewHandleBoardMoveRef.current(from, to);
            }
          }
        }
      },
      draggable: {
        enabled: true,
        showGhost: true
      },
      selectable: {
        enabled: true
      },
      highlight: {
        lastMove: true,
        check: true
      },
      drawable: {
        shapes: shapes as any
      }
    };

    previewCgRef.current.set(config);
  }, [activeLine, currentPlyIndex, game.startingColor, game.initialFen, isFlipped, freestyleMode, activeTab, isPuzzleActive]);

  // Move validation error states
  const [moveValidationError, setMoveValidationError] = useState<string | null>(null);
  const [editMoveValidationError, setEditMoveValidationError] = useState<string | null>(null);

  // Derive PGN validity
  const isPgnValid = checkPgnValidity(game.moves, game.startingColor, game.initialFen);

  // Inline confirmations
  const [confirmDeleteGame, setConfirmDeleteGame] = useState(false);

  // Analysis Report Form states
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportEval, setReportEval] = useState('0.00 Equal');
  const [reportNotes, setReportNotes] = useState('');
  const [reportMistakes, setReportMistakes] = useState('');
  const [reportConclusion, setReportConclusion] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const scoresheetEndRef = useRef<HTMLDivElement>(null);

  // Stockfish engine states
  const [isEngineActive, setIsEngineActive] = useState(false);
  const [isEngineLoading, setIsEngineLoading] = useState(false);
  const [engineEval, setEngineEval] = useState('0.00');
  const [engineDepth, setEngineDepth] = useState(0);
  const [enginePv, setEnginePv] = useState('');
  const [engineBestMove, setEngineBestMove] = useState('');
  const [engineCentipawns, setEngineCentipawns] = useState(0);

  const workerRef = useRef<Worker | null>(null);

  // Toggle/start Stockfish engine
  const startEngine = () => {
    if (workerRef.current) return;

    setIsEngineLoading(true);
    try {
      // Create inline worker script to bypass CORS via importScripts
      const blob = new Blob([
        `importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');`
      ], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (e: MessageEvent) => {
        const line = e.data;
        
        if (line.startsWith('readyok')) {
          setIsEngineLoading(false);
          setIsEngineActive(true);
        } else if (line.startsWith('info depth')) {
          const matchDepth = line.match(/depth (\d+)/);
          const matchScore = line.match(/score (cp|mate) (-?\d+)/);
          const matchPv = line.match(/ pv (.+)/);

          if (matchDepth) {
            setEngineDepth(parseInt(matchDepth[1], 10));
          }

          if (matchScore) {
            const scoreType = matchScore[1];
            const scoreVal = parseInt(matchScore[2], 10);
            
            const fen = getFenAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);
            const activeColor = fen.split(' ')[1];

            let formatted = '0.00';
            let cpVal = 0;
            if (scoreType === 'cp') {
              const rel = scoreVal / 100;
              const abs = activeColor === 'b' ? -rel : rel;
              formatted = (abs > 0 ? '+' : '') + abs.toFixed(2);
              cpVal = abs;
            } else if (scoreType === 'mate') {
              const abs = activeColor === 'b' ? -scoreVal : scoreVal;
              formatted = 'M' + (abs > 0 ? '+' : '') + abs;
              cpVal = abs > 0 ? 10 : -10; // high value for mate
            }
            setEngineEval(formatted);
            setEngineCentipawns(cpVal);
          }

          if (matchPv) {
            setEnginePv(matchPv[1]);
          }
        } else if (line.startsWith('bestmove')) {
          const matchBest = line.match(/bestmove ([a-h1-8qrbn]+)/);
          if (matchBest) {
            setEngineBestMove(matchBest[1]);
          }
        }
      };

      worker.postMessage('uci');
      worker.postMessage('isready');
      workerRef.current = worker;
    } catch (err) {
      console.error('Failed to load Stockfish worker:', err);
      setIsEngineLoading(false);
    }
  };

  const stopEngine = () => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop');
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsEngineActive(false);
    setIsEngineLoading(false);
    setEngineEval('0.00');
    setEngineDepth(0);
    setEngineBestMove('');
    setEnginePv('');
    setEngineCentipawns(0);
  };

  // Run stockfish search when position changes
  useEffect(() => {
    if (!isEngineActive || !workerRef.current) return;

    // Reset current evaluation display for freshness
    setEngineEval('...');
    setEngineDepth(0);
    setEngineBestMove('');
    setEnginePv('');

    const fen = getFenAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);
    workerRef.current.postMessage('stop');
    workerRef.current.postMessage(`position fen ${fen}`);
    workerRef.current.postMessage('go depth 12');
  }, [currentPlyIndex, activeLine, isEngineActive, game.startingColor]);

  // Clean up engine worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Reset active board preview indices when game loads
  useEffect(() => {
    setActiveLine(game.moves);
    setCurrentPlyIndex(game.moves.length);
    setIsPlaying(false);
    setConfirmDeleteGame(false);
    setEditingPlyIndex(null);
    setEditingCommentPlyId(null);
    setConfirmTruncateIndex(null);
    setIsAddingReport(false);
    setUndoneMoves([]);
    setUndoHistory([]);
    setRedoHistory([]);
    setPuzzleEditMode(false);

    // Auto-disable freestyleMode for puzzles or valid games so interactive board/engine works
    const isValid = checkPgnValidity(game.moves, game.startingColor, game.initialFen);
    if (game.initialFen || (game.moves.length > 0 && isValid)) {
      setFreestyleMode(false);
    } else {
      setFreestyleMode(true);
    }
  }, [game.id]);

  // Keep preview position at the end when moves are appended live
  useEffect(() => {
    setActiveLine(game.moves);
    setCurrentPlyIndex(game.moves.length);
  }, [game.moves.length]);

  const goToPreviousPly = () => {
    if (currentPlyIndex > 0) {
      const currentPly = activeLine[currentPlyIndex - 1];
      if (currentPly) {
        const pathInfo = findPlyPath(game.moves, currentPly.id);
        if (pathInfo && pathInfo.parentPly && pathInfo.index === 0) {
          const parentLineInfo = findLineForPly(game.moves, pathInfo.parentPly.id);
          if (parentLineInfo) {
            const parentLine = [...parentLineInfo.prefix, ...parentLineInfo.continuation];
            setActiveLine(parentLine);
            setCurrentPlyIndex(parentLineInfo.prefix.length);
            return;
          }
        }
      }
      setCurrentPlyIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const goToNextPly = () => {
    if (currentPlyIndex < activeLine.length) {
      if (currentPlyIndex > 0) {
        const currentPly = activeLine[currentPlyIndex - 1];
        if (currentPly) {
          const pathInfo = findPlyPath(game.moves, currentPly.id);
          if (pathInfo && pathInfo.parentPly && pathInfo.index === pathInfo.line.length - 1) {
            // Last move of a variation: right arrow does nothing
            return;
          }
        }
      }
      setCurrentPlyIndex((prev) => Math.min(activeLine.length, prev + 1));
    }
  };

  // Global key navigation for chess plies, Alt+S starting color toggle, and Ctrl+Z undo shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Shortcut Alt+S to toggle starting color
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleToggleStartingColor();
        return;
      }

      // Find what element is active
      const target = e.target as HTMLElement;
      const isInputOrTextArea = target && (
        target.tagName === 'TEXTAREA' || 
        (target.tagName === 'INPUT' && target.id !== 'rapid-move-text-input') ||
        (target.tagName === 'INPUT' && target.id === 'rapid-move-text-input' && (target as HTMLInputElement).value !== '')
      );
      if (isInputOrTextArea) return;

      // Ctrl + Z / Cmd + Z: Undo move
      const isModifierPressed = e.ctrlKey || e.metaKey;
      if (isModifierPressed && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoLastMove();
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousPly();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPly();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeLine, currentPlyIndex, game, undoHistory, onUpdateGame]);

  // Force General Notes tab if PGN is invalid or Freestyle Mode is active
  useEffect(() => {
    if (!isPgnValid || freestyleMode) {
      setActiveTab('notes');
    }
  }, [isPgnValid, freestyleMode]);

  // Clear validation errors when inputs change
  useEffect(() => {
    setMoveValidationError(null);
  }, [moveInput]);

  useEffect(() => {
    setEditMoveValidationError(null);
  }, [editingMoveValue]);

  // Focus move input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [game.id]);

  // Auto-scroll scoresheet to bottom on move additions
  useEffect(() => {
    scoresheetEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [game.moves.length]);

  // Autoplay slideshow effect
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentPlyIndex((prev) => {
        if (prev >= game.moves.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying, game.moves.length]);

  // Determine whose turn it is
  const isWhitesTurn = () => {
    const totalMoves = game.moves.length;
    if (game.startingColor === 'black') {
      return totalMoves % 2 !== 0;
    } else {
      return totalMoves % 2 === 0;
    }
  };

  const getCurrentMoveNumber = () => {
    const totalMoves = game.moves.length;
    if (game.startingColor === 'black') {
      return Math.floor((totalMoves + 1) / 2) + 1;
    } else {
      return Math.floor(totalMoves / 2) + 1;
    }
  };

  const handleMoveInputSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const cleanMove = moveInput.trim();
    if (!cleanMove) return;

    if (editingHistoryIndex !== null) {
      // Get board state before this ply to validate
      const currentFen = getFenAtPly(activeLine, editingHistoryIndex, game.startingColor, game.initialFen);
      const validation = validateMoveInput(cleanMove, currentFen, freestyleMode);
      if (!validation.isValid) {
        setMoveValidationError(validation.error || 'Invalid move.');
        return;
      }

      // Update in-place in activeLine and tree
      const plyToEdit = activeLine[editingHistoryIndex];
      const resPlies = updateCommentInTree(game.moves, plyToEdit.id, plyToEdit.comment); // Just ensuring tree sync, but we want to change .move too
      // Let's make a recursive helper or map to update ply's move in the tree
      const updateMoveInTree = (plies: MovePly[], id: string, newMove: string): MovePly[] => {
        return plies.map(ply => {
          if (ply.id === id) {
            return { ...ply, move: newMove };
          }
          if (ply.variations) {
            return {
              ...ply,
              variations: ply.variations.map(v => updateMoveInTree(v, id, newMove))
            };
          }
          return ply;
        });
      };

      // Record history
      setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
      setRedoHistory([]);

      const updatedPlies = updateMoveInTree(game.moves, plyToEdit.id, validation.fixedMove!);
      const updatedGame: Game = {
        ...game,
        moves: updatedPlies
      };

      onUpdateGame(updatedGame);
      setMoveInput('');
      setEditingHistoryIndex(null);
      setMoveValidationError(null);

      // Sync activeLine
      const activeRes = findLineForPly(updatedPlies, plyToEdit.id);
      if (activeRes) {
        const newLine = [...activeRes.prefix, ...activeRes.continuation];
        setActiveLine(newLine);
      }
    } else {
      // Get board state before this ply to validate
      const currentFen = getFenAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);

      const validation = validateMoveInput(cleanMove, currentFen, freestyleMode);
      if (!validation.isValid) {
        setMoveValidationError(validation.error || 'Invalid move.');
        return;
      }

      // Create new ply
      const newPly: MovePly = {
        id: Math.random().toString(36).substring(2, 11),
        move: validation.fixedMove!,
      };

      const parentPlyId = currentPlyIndex > 0 ? activeLine[currentPlyIndex - 1]?.id : null;
      setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
      setRedoHistory([]);
      const res = insertMoveIntoTree(game.moves, parentPlyId, newPly);

      const updatedGame: Game = {
        ...game,
        moves: res.updatedPlies
      };

      onUpdateGame(updatedGame);
      setMoveInput('');
      setUndoneMoves([]); // Clear redo stack on manual entry
      setMoveValidationError(null);

      // Reconstruct activeLine and set ply index to the played move
      const activeRes = findLineForPly(res.updatedPlies, newPly.id);
      if (activeRes) {
        const newLine = [...activeRes.prefix, ...activeRes.continuation];
        setActiveLine(newLine);
        setCurrentPlyIndex(activeRes.prefix.length + 1);
      }
    }
  };

  // Keyboard controls for rapid input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' && moveInput.trim()) {
      e.preventDefault();
      handleMoveInputSubmit(e);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeLine.length === 0) return;

      let nextIndex = editingHistoryIndex;
      if (nextIndex === null) {
        // Save what they were currently typing so we don't lose it
        setTempInputText(moveInput);
        nextIndex = activeLine.length - 1;
      } else if (nextIndex > 0) {
        nextIndex = nextIndex - 1;
      } else {
        // Already at the oldest move, do nothing
        return;
      }

      setEditingHistoryIndex(nextIndex);
      setMoveInput(activeLine[nextIndex].move);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (editingHistoryIndex === null) return;

      if (editingHistoryIndex < activeLine.length - 1) {
        const nextIndex = editingHistoryIndex + 1;
        setEditingHistoryIndex(nextIndex);
        setMoveInput(activeLine[nextIndex].move);
      } else {
        // Return to the draft input
        setEditingHistoryIndex(null);
        setMoveInput(tempInputText);
      }
    } else if (e.key === 'Escape') {
      if (editingHistoryIndex !== null) {
        e.preventDefault();
        setEditingHistoryIndex(null);
        setMoveInput(tempInputText);
      }
    }
  };

  const handleUndoLastMove = () => {
    if (undoHistory.length > 0) {
      const previousState = undoHistory[undoHistory.length - 1];
      setUndoHistory(prev => prev.slice(0, -1));
      setRedoHistory(prev => [
        ...prev,
        {
          moves: game.moves,
          activeLine: activeLine,
          currentPlyIndex: currentPlyIndex
        }
      ]);
      
      onUpdateGame({ ...game, moves: previousState.moves });
      setActiveLine(previousState.activeLine);
      setCurrentPlyIndex(previousState.currentPlyIndex);
    } else if (game.moves.length > 0) {
      setRedoHistory(prev => [
        ...prev,
        {
          moves: game.moves,
          activeLine: activeLine,
          currentPlyIndex: currentPlyIndex
        }
      ]);
      
      const previousMoves = game.moves.slice(0, -1);
      onUpdateGame({ ...game, moves: previousMoves });
      setActiveLine(previousMoves);
      setCurrentPlyIndex(Math.min(currentPlyIndex, previousMoves.length));
    }
  };

  const handleRedoLastMove = () => {
    if (redoHistory.length > 0) {
      const nextState = redoHistory[redoHistory.length - 1];
      setRedoHistory(prev => prev.slice(0, -1));
      setUndoHistory(prev => [
        ...prev,
        {
          moves: game.moves,
          activeLine: activeLine,
          currentPlyIndex: currentPlyIndex
        }
      ]);
      
      onUpdateGame({ ...game, moves: nextState.moves });
      setActiveLine(nextState.activeLine);
      setCurrentPlyIndex(nextState.currentPlyIndex);
    }
  };

  const handleToggleStartingColor = () => {
    const updatedGame: Game = {
      ...game,
      startingColor: game.startingColor === 'white' ? 'black' : 'white'
    };
    onUpdateGame(updatedGame);
  };

  // Save changes to inline move edit
  const handleSavePlyEdit = () => {
    if (editingPlyIndex === null) return;
    
    const cleanMoveValue = editingMoveValue.trim();
    const updatedMoves = [...game.moves];
    
    if (cleanMoveValue === '') {
      updatedMoves.splice(editingPlyIndex, 1);
    } else {
      // Get board state before this ply to validate
      const currentFen = getFenAtPly(game.moves, editingPlyIndex, game.startingColor, game.initialFen);
      
      const validation = validateMoveInput(cleanMoveValue, currentFen, freestyleMode);
      if (!validation.isValid) {
        setEditMoveValidationError(validation.error || 'Invalid move.');
        return;
      }
      
      updatedMoves[editingPlyIndex] = {
        ...updatedMoves[editingPlyIndex],
        move: validation.fixedMove!,
        comment: editingCommentValue.trim() || undefined
      };
    }

    // Record history
    setUndoHistory(prev => [...prev, { moves: game.moves, activeLine, currentPlyIndex }]);
    setRedoHistory([]);

    const updatedGame: Game = {
      ...game,
      moves: updatedMoves
    };

    onUpdateGame(updatedGame);
    setEditingPlyIndex(null);
    setEditMoveValidationError(null);
  };

  const handleDeletePly = (index: number) => {
    const updatedMoves = [...game.moves];
    updatedMoves.splice(index, 1);

    const updatedGame: Game = {
      ...game,
      moves: updatedMoves
    };

    onUpdateGame(updatedGame);
    setEditingPlyIndex(null);
  };

  const handleTruncateFromPly = (index: number) => {
    setConfirmTruncateIndex(index);
  };

  const triggerExport = () => {
    const pgn = exportToPGN(game, folderName);
    setExportedPgnText(pgn);
    setIsCopied(false);
    setShowExportModal(true);
  };

  const handleDownloadPgnFile = () => {
    const blob = new Blob([exportedPgnText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.title.replace(/\s+/g, '_') || 'chess_game'}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyPgnToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportedPgnText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy PGN:', err);
    }
  };

  // Saved Analysis Reports Management
  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) return;

    const newReport: AnalysisReport = {
      id: 'rep-' + Math.random().toString(36).substring(2, 9),
      title: reportTitle.trim(),
      plyIndex: currentPlyIndex,
      evaluation: reportEval,
      strategicNotes: reportNotes.trim(),
      tacticalMistakes: reportMistakes.trim() || undefined,
      conclusion: reportConclusion.trim() || undefined,
      timestamp: new Date().toLocaleDateString()
    };

    const currentReports = game.analysisReports || [];
    const updatedGame: Game = {
      ...game,
      analysisReports: [...currentReports, newReport]
    };

    onUpdateGame(updatedGame);

    // Reset Form
    setReportTitle('');
    setReportNotes('');
    setReportMistakes('');
    setReportConclusion('');
    setIsAddingReport(false);
  };

  const handleDeleteReport = (reportId: string) => {
    const currentReports = game.analysisReports || [];
    const updatedGame: Game = {
      ...game,
      analysisReports: currentReports.filter(r => r.id !== reportId)
    };
    onUpdateGame(updatedGame);
  };

  // Beautiful recursive visual tree scoresheet renderer supporting variations and annotations
  const renderMoveTree = (
    plies: MovePly[],
    startingColor: 'white' | 'black',
    initialRound: number,
    depth: number = 0
  ): React.ReactNode => {
    if (!plies || plies.length === 0) return null;

    let currentRound = initialRound;
    let isWhiteTurn = startingColor === 'white';
    
    const rows: React.ReactNode[] = [];

    // Helper to render a single ply component (with its hover actions)
    const renderPlyCell = (ply: MovePly, isWhiteCell: boolean) => {
      const isSelected = activeLine[currentPlyIndex - 1]?.id === ply.id;
      const strippedComment = stripShapesFromComment(ply.comment || '');

      const handlePlyClick = () => {
        const lineInfo = findLineForPly(game.moves, ply.id);
        if (lineInfo) {
          const newLine = [...lineInfo.prefix, ...lineInfo.continuation];
          setActiveLine(newLine);
          setCurrentPlyIndex(lineInfo.prefix.length + 1);
        }
      };

      return (
        <div key={ply.id} className="relative group flex items-center justify-between gap-1 w-full" id={`scoresheet-ply-cell-${ply.id}`}>
          {editingPlyIndex === ply.id ? (
            <input
              type="text"
              value={editingMoveValue}
              onChange={(e) => setEditingMoveValue(e.target.value)}
              className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold border rounded outline-none bg-amber-500/10 border-amber-400 text-amber-600 dark:text-amber-450"
              autoFocus
              onBlur={() => handleSavePlyEditInPlace(ply.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePlyEditInPlace(ply.id);
                if (e.key === 'Escape') setEditingPlyIndex(null);
              }}
              id={`input-edit-ply-${ply.id}`}
            />
          ) : (
            <span
              onClick={handlePlyClick}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-all font-mono ${
                depth > 0 ? 'text-xs font-medium' : 'text-[13px] font-semibold'
              } ${
                isSelected
                  ? 'bg-amber-500 text-white font-bold scale-[1.02] shadow-sm shadow-amber-500/10'
                  : depth > 0
                    ? (darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-stone-700 hover:bg-stone-100')
                    : (darkMode ? 'text-zinc-100 hover:bg-zinc-800' : 'text-stone-900 hover:bg-stone-150')
              }`}
              id={`scoresheet-ply-btn-${ply.id}`}
            >
              {ply.move}
            </span>
          )}

          {/* Inline Action Hover Buttons */}
          {!isPuzzleActive && editingPlyIndex !== ply.id && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-850 px-1 py-0.5 rounded border border-stone-200 dark:border-zinc-800 ml-1 shrink-0" id={`actions-ply-${ply.id}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingPlyIndex(ply.id);
                  setEditingMoveValue(ply.move);
                }}
                className="p-0.5 rounded hover:bg-zinc-500/20 text-stone-500 dark:text-zinc-400 hover:text-amber-500"
                title="Edit Move Text"
                id={`btn-edit-text-${ply.id}`}
              >
                <Tag className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCommentPlyId(ply.id);
                  setEditingCommentValue(strippedComment);
                }}
                className="p-0.5 rounded hover:bg-zinc-500/20 text-stone-500 dark:text-zinc-400 hover:text-amber-500"
                title="Add / Edit Annotation"
                id={`btn-edit-annotation-${ply.id}`}
              >
                <MessageSquarePlus className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePlyInPlace(ply.id);
                }}
                className="p-0.5 rounded hover:bg-zinc-500/20 text-stone-500 dark:text-zinc-400 hover:text-red-500"
                title="Delete Move"
                id={`btn-delete-${ply.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      );
    };

    // Helper to render annotation and/or edit form spanning the full row
    const renderAnnotationBlock = (ply: MovePly) => {
      const strippedComment = stripShapesFromComment(ply.comment || '');
      const isEditing = editingCommentPlyId === ply.id;

      if (!strippedComment && !isEditing) return null;

      return (
        <div key={`ann-block-${ply.id}`} className="col-span-3 pl-2.5 my-1" id={`scoresheet-ply-ann-wrapper-${ply.id}`}>
          {isEditing ? (
            <div className="pl-2 border-l-2 border-amber-500/50 dark:border-amber-400/50" onClick={(e) => e.stopPropagation()} id={`edit-annotation-box-${ply.id}`}>
              <textarea
                value={editingCommentValue}
                onChange={(e) => {
                  setEditingCommentValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className={`w-full bg-transparent outline-none border-none text-xs leading-relaxed italic font-sans p-0 resize-none ${
                  darkMode ? 'text-amber-400/90' : 'text-amber-700/90'
                }`}
                rows={1}
                autoFocus
                placeholder="Type annotation..."
                onFocus={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveCommentInPlace(ply.id);
                  } else if (e.key === 'Escape') {
                    setEditingCommentPlyId(null);
                  }
                }}
                id={`textarea-annotation-${ply.id}`}
              />
              <div className="flex items-center gap-2 mt-1 text-[10px] text-stone-500 dark:text-zinc-500 select-none">
                <button
                  onClick={() => handleSaveCommentInPlace(ply.id)}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                  id={`btn-save-annotation-${ply.id}`}
                >
                  Save
                </button>
                <span>•</span>
                <button
                  onClick={() => setEditingCommentPlyId(null)}
                  className="hover:underline"
                  id={`btn-cancel-annotation-${ply.id}`}
                >
                  Cancel
                </button>
                <span>•</span>
                <span>Enter to save, Shift+Enter for new line</span>
              </div>
            </div>
          ) : (
            <div className={`text-xs leading-relaxed italic font-sans border-l-2 pl-2 ${
              darkMode ? 'border-amber-500/30 text-amber-400/90' : 'border-amber-400/50 text-amber-700/90'
            }`} id={`annotation-display-${ply.id}`}>
              {strippedComment}
            </div>
          )}
        </div>
      );
    };

    // Helper to render nested variations spanning the full row
    const renderVariationsBlock = (ply: MovePly, isWhiteTurnAtPly: boolean) => {
      if (!ply.variations || ply.variations.length === 0) return null;

      return (
        <div key={`vars-block-${ply.id}`} className="col-span-3 pl-3 border-l border-stone-250 dark:border-zinc-800/80 my-1 space-y-1.5 w-full">
          {ply.variations.map((variation, vIndex) => (
            <div
              key={`${ply.id}-var-${vIndex}`}
              className={`p-2 rounded-lg border text-xs leading-relaxed max-w-full ${
                darkMode
                  ? 'bg-zinc-950/60 border-zinc-900 text-zinc-400'
                  : 'bg-stone-100/65 border-stone-200 text-stone-600'
              }`}
              id={`var-box-${ply.id}-${vIndex}`}
            >
              {renderMoveTree(variation, isWhiteTurnAtPly ? 'white' : 'black', currentRound, depth + 1)}
            </div>
          ))}
        </div>
      );
    };

    for (let i = 0; i < plies.length; i++) {
      const ply = plies[i];

      if (isWhiteTurn) {
        // Can we pair it with the next move?
        const nextPly = plies[i + 1];
        const hasComment = !!stripShapesFromComment(ply.comment || '') || editingCommentPlyId === ply.id;

        if (nextPly && !hasComment) {
          // Pair White and Black on the same row if White has no annotations (Black can have annotations beneath)
          rows.push(
            <React.Fragment key={`row-${ply.id}`}>
              {/* Move Number */}
              <div className="font-semibold text-xs font-mono text-stone-400 dark:text-zinc-500 select-none py-1 align-middle">
                {currentRound}
              </div>
              {/* White Cell */}
              <div className="py-0.5 pr-2 flex items-center">
                {renderPlyCell(ply, true)}
              </div>
              {/* Black Cell */}
              <div className="py-0.5 pr-2 flex items-center">
                {renderPlyCell(nextPly, false)}
              </div>

              {/* Annotation beneath (e.g. for Black) */}
              {renderAnnotationBlock(nextPly)}

              {/* Variations blocks if any exist */}
              {renderVariationsBlock(ply, false)}
              {renderVariationsBlock(nextPly, true)}
            </React.Fragment>
          );

          // We advanced by 2 plies
          i++;
          isWhiteTurn = true;
          currentRound++;
        } else {
          // Render White move only, with Black as "..."
          rows.push(
            <React.Fragment key={`row-${ply.id}`}>
              {/* Move Number */}
              <div className="font-semibold text-xs font-mono text-stone-400 dark:text-zinc-500 select-none py-1 align-middle">
                {currentRound}
              </div>
              {/* White Cell */}
              <div className="py-0.5 pr-2 flex items-center">
                {renderPlyCell(ply, true)}
              </div>
              {/* Black Cell placeholder */}
              <div className="py-0.5 text-xs font-mono text-stone-300 dark:text-zinc-700 select-none">
                {i === plies.length - 1 ? "" : "..."}
              </div>

              {/* Annotation beneath */}
              {renderAnnotationBlock(ply)}

              {/* Variations block */}
              {renderVariationsBlock(ply, false)}
            </React.Fragment>
          );

          isWhiteTurn = false;
        }
      } else {
        // Render Black move only, with White as "..."
        rows.push(
          <React.Fragment key={`row-${ply.id}`}>
            {/* Move Number */}
            <div className="font-semibold text-xs font-mono text-stone-400 dark:text-zinc-500 select-none py-1 align-middle">
              {currentRound}
            </div>
            {/* White Cell placeholder */}
            <div className="py-0.5 text-xs font-mono text-stone-300 dark:text-zinc-700 select-none">
              ...
            </div>
            {/* Black Cell */}
            <div className="py-0.5 pr-2 flex items-center">
              {renderPlyCell(ply, false)}
            </div>

            {/* Annotation beneath */}
            {renderAnnotationBlock(ply)}

            {/* Variations block */}
            {renderVariationsBlock(ply, true)}
          </React.Fragment>
        );

        isWhiteTurn = true;
        currentRound++;
      }
    }

    return (
      <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-2 gap-y-1 items-center w-full">
        {rows}
      </div>
    );
  };

  // Get active computed board state for active preview position
  const activeBoard = getBoardAtPly(activeLine, currentPlyIndex, game.startingColor, game.initialFen);
  const materialBalance = getMaterialBalance(activeBoard);

  // Generate coordinate lists based on orientation
  const displayedRanks = isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const displayedFiles = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  return (
    <div className={`flex-1 h-full flex flex-col overflow-hidden transition-colors ${
      darkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-stone-900'
    }`} id="game-editor-container">
      
      {/* Top Action Bar */}
      <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
        darkMode ? 'border-zinc-800 bg-zinc-950/40' : 'border-stone-200 bg-stone-50/50'
      }`} id="editor-action-bar">
        
        {/* Game Title Info */}
        <div className="flex items-center gap-3 min-w-0" id="editor-title-container">
          {/* Star Toggle Button */}
          <button
            onClick={() => onUpdateGame({ ...game, starred: !game.starred })}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${
              game.starred 
                ? 'text-amber-500 bg-amber-500/10' 
                : darkMode 
                  ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' 
                  : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
            }`}
            title={game.starred ? "Remove from Favorites" : "Mark as Favorite"}
            id="btn-toggle-star-editor"
          >
            <Star className={`w-4.5 h-4.5 ${game.starred ? 'fill-amber-500' : ''}`} />
          </button>

          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={game.title}
              onChange={(e) => onUpdateGame({ ...game, title: e.target.value })}
              className={`text-lg font-bold outline-none border-b border-transparent hover:border-stone-300 dark:hover:border-zinc-700 focus:border-amber-500 w-full truncate bg-transparent py-0.5`}
              placeholder="Game Title"
              id="game-title-input"
            />
            <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-0.5 ${
              darkMode ? 'text-zinc-500' : 'text-stone-500'
            }`}>
              <span className={`font-semibold px-1.5 py-0.2 rounded ${
                darkMode ? 'bg-zinc-800 text-amber-400' : 'bg-stone-200/60 text-stone-700'
              }`}>{folderName}</span>
              <span>•</span>
              <span>{game.date}</span>
              {(!isPuzzleActive || puzzleState === 'solved') && (
                <>
                  <span>•</span>
                  <span>{Math.ceil(game.moves.length / 2)} moves ({game.moves.length} plies)</span>
                </>
              )}
              
              {/* Tags Section */}
              {(!isPuzzleActive || puzzleState === 'solved') && (
                <div className="flex flex-wrap items-center gap-1.5 ml-1">
                  {game.tags && game.tags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-stone-200/60 dark:border-zinc-700"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => {
                          const newTags = (game.tags || []).filter(t => t !== tag);
                          onUpdateGame({ ...game, tags: newTags });
                        }}
                        className="text-stone-400 hover:text-red-500 transition-colors"
                        title={`Remove tag ${tag}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  
                  {/* Add Tag Button */}
                  <button
                    onClick={() => {
                      const tagText = prompt("Enter a new tag name (e.g., Opening, Tactics, Endgame):");
                      if (tagText && tagText.trim()) {
                        const cleanTag = tagText.trim();
                        const existingTags = game.tags || [];
                        if (!existingTags.includes(cleanTag)) {
                          onUpdateGame({ ...game, tags: [...existingTags, cleanTag] });
                        }
                      }
                    }}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-dashed transition-colors ${
                      darkMode 
                        ? 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300' 
                        : 'border-stone-300 text-stone-500 hover:border-stone-400 hover:text-stone-700'
                    }`}
                    title="Add tag"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Tag</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isPuzzle && (
            <button
              onClick={() => {
                const nextEditMode = !puzzleEditMode;
                setPuzzleEditMode(nextEditMode);
                if (nextEditMode) {
                  setActiveTab('board');
                }
              }}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                puzzleEditMode
                  ? 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/50 text-amber-950 dark:text-amber-400 font-bold'
                  : darkMode
                    ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
                    : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-850'
              }`}
              title={puzzleEditMode ? "Switch to Puzzle Solving Mode" : "Switch to Note Editing Mode"}
              id="btn-toggle-puzzle-edit-mode"
            >
              {puzzleEditMode ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Edit className="w-4 h-4" />}
              <span className="hidden sm:inline">{puzzleEditMode ? 'Puzzle Mode' : 'Note Edit Mode'}</span>
            </button>
          )}

          <button
            onClick={() => setHideRightSidebar(!hideRightSidebar)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              hideRightSidebar
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/40 text-amber-800 dark:text-amber-400'
                : darkMode
                  ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
                  : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
            }`}
            title="Toggle Notes Sidebar"
            id="btn-toggle-notes-sidebar"
          >
            {hideRightSidebar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{hideRightSidebar ? 'Show Sidebar' : 'Hide Sidebar'}</span>
          </button>

          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showMetadata
                ? 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/50 text-amber-900 dark:text-amber-400'
                : darkMode
                  ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
                  : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-850'
            }`}
            id="btn-toggle-headers"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Chess Headers</span>
            {showMetadata ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={triggerExport}
            className={`p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-amber-900/10`}
            title="Export game as standard Portable Game Notation (.pgn)"
            id="btn-export-pgn"
          >
            <Download className="w-4 h-4" />
            <span>Export PGN</span>
          </button>

          {/* Inline Game Deletion Confirmation */}
          {confirmDeleteGame ? (
            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-1 rounded-lg">
              <span className="text-[10px] font-bold text-red-700 dark:text-red-400 px-1">Delete?</span>
              <button
                onClick={() => {
                  onDeleteGame(game.id);
                  setConfirmDeleteGame(false);
                }}
                className="py-1 px-2.5 bg-red-600 text-white font-bold text-[10px] rounded hover:bg-red-500 transition-colors"
                id="btn-confirm-delete-game"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDeleteGame(false)}
                className="py-1 px-2.5 bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-[10px] rounded hover:bg-stone-300 dark:hover:bg-zinc-750 transition-colors"
                id="btn-cancel-delete-game"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteGame(true)}
              className={`p-2 rounded-lg border transition-all ${
                darkMode
                  ? 'bg-zinc-900 hover:bg-red-950/20 hover:text-red-400 border-zinc-800 text-zinc-400'
                  : 'bg-stone-100 hover:bg-red-50 hover:text-red-600 border-stone-200 text-stone-650'
              }`}
              title="Delete Game Scorebook"
              id="btn-delete-game"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Chess Headers / Metadata Form */}
      {showMetadata && (
        <div className={`p-6 border-b grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all ${
          darkMode ? 'bg-zinc-950/20 border-zinc-800' : 'bg-stone-50/30 border-stone-200'
        }`} id="chess-headers-drawer">
          
          {/* White Player */}
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <User className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500" /> White Player
            </label>
            <input
              type="text"
              value={game.whitePlayer || ''}
              onChange={(e) => onUpdateGame({ ...game, whitePlayer: e.target.value })}
              className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-white focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              placeholder="e.g. Magnus Carlsen"
              id="header-white-player"
            />
          </div>

          {/* Black Player */}
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <User className="w-3.5 h-3.5 text-stone-900 dark:text-zinc-100" /> Black Player
            </label>
            <input
              type="text"
              value={game.blackPlayer || ''}
              onChange={(e) => onUpdateGame({ ...game, blackPlayer: e.target.value })}
              className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-white focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              placeholder="e.g. Hikaru Nakamura"
              id="header-black-player"
            />
          </div>

          {/* Result */}
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <Trophy className="w-3.5 h-3.5 text-amber-500" /> Game Result
            </label>
            <select
              value={game.result || '*'}
              onChange={(e) => onUpdateGame({ ...game, result: e.target.value })}
              className={`px-3 py-1.5 text-xs rounded-md outline-none border cursor-pointer ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-white focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              id="header-result"
            >
              <option value="*">Ongoing / Unspecified (*)</option>
              <option value="1-0">White Won (1-0)</option>
              <option value="0-1">Black Won (0-1)</option>
              <option value="1/2-1/2">Draw (1/2-1/2)</option>
            </select>
          </div>

          {/* Event */}
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <BookOpen className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500" /> Event / Tournament
            </label>
            <input
              type="text"
              value={game.event || ''}
              onChange={(e) => onUpdateGame({ ...game, event: e.target.value })}
              className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-white focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              placeholder="e.g. World Championship 2026"
              id="header-event"
            />
          </div>

          {/* Site */}
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <MapPin className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500" /> Location / Site
            </label>
            <input
              type="text"
              value={game.site || ''}
              onChange={(e) => onUpdateGame({ ...game, site: e.target.value })}
              className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-white focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              placeholder="e.g. London, ENG"
              id="header-site"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-zinc-500" /> Game Date
            </label>
            <input
              type="date"
              value={game.date}
              onChange={(e) => onUpdateGame({ ...game, date: e.target.value })}
              className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-white focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              id="header-date"
            />
          </div>

          {/* Starting position FEN */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-1 border-t pt-4 border-stone-100 dark:border-zinc-800">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Custom Starting Position (FEN)
              </div>
              {game.initialFen && (
                <button
                  onClick={() => onUpdateGame({ ...game, initialFen: undefined })}
                  className="text-[10px] text-red-600 dark:text-red-400 hover:underline font-semibold"
                  id="btn-reset-fen"
                >
                  Reset to Standard Board
                </button>
              )}
            </label>
            <input
              type="text"
              value={game.initialFen || ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                onUpdateGame({ ...game, initialFen: val || undefined });
              }}
              className={`px-3 py-2 text-xs rounded-md outline-none border font-mono ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              placeholder="e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              id="header-starting-fen"
            />
            <p className={`text-[10px] ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
              Provide a Chess FEN string to start this scoresheet from a custom board setup. Standard PGN Setup and FEN headers will be exported.
            </p>
          </div>

          {/* Raw PGN Editor & Fixer */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col gap-1.5 border-t pt-4 border-stone-100 dark:border-zinc-800">
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              darkMode ? 'text-zinc-400' : 'text-stone-500'
            }`}>
              <Tag className="w-3.5 h-3.5 text-amber-500" /> Edit & Fix Raw PGN Code
            </label>
            <textarea
              value={rawPgnInput}
              onChange={(e) => setRawPgnInput(e.target.value)}
              className={`w-full h-44 px-3 py-2 text-xs rounded-md outline-none border font-mono leading-relaxed ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-700'
                  : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
              }`}
              placeholder="Paste or write your raw PGN notation here..."
              id="raw-pgn-textarea"
            />
            {pgnInputError && (
              <p className="text-[11px] font-semibold text-rose-500">
                {pgnInputError}
              </p>
            )}
            {pgnInputSuccess && (
              <p className="text-[11px] font-semibold text-emerald-500">
                ✓ PGN parsed and updated successfully!
              </p>
            )}
            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsedList = parsePGN(rawPgnInput);
                    if (parsedList.length === 0) {
                      setPgnInputError('No valid PGN game found. Please check formatting.');
                      setPgnInputSuccess(false);
                      return;
                    }
                    const parsed = parsedList[0];
                    const updatedGame: Game = {
                      ...game,
                      title: parsed.title || game.title,
                      whitePlayer: parsed.whitePlayer || undefined,
                      blackPlayer: parsed.blackPlayer || undefined,
                      result: parsed.result || undefined,
                      event: parsed.event || undefined,
                      site: parsed.site || undefined,
                      date: parsed.date || game.date,
                      initialFen: parsed.initialFen || undefined,
                      moves: parsed.moves || [],
                    };
                    onUpdateGame(updatedGame);
                    setPgnInputError(null);
                    setPgnInputSuccess(true);
                    setTimeout(() => setPgnInputSuccess(false), 3000);
                  } catch (err: any) {
                    setPgnInputError(`PGN Error: ${err?.message || err}`);
                    setPgnInputSuccess(false);
                  }
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
                id="btn-apply-raw-pgn"
              >
                Apply & Fix PGN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Scoresheet & Tabbed Workspace (Scrollable) */}
      {isPuzzleActive ? (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row" id="puzzle-workspace-layout">
          {/* Left/Middle: Interactive Chessground Board */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-stone-100/35 dark:bg-zinc-900/10" id="puzzle-board-container">
            <div className="w-full max-w-[480px] flex flex-col gap-3">
              {/* Turn indicator */}
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className={`${darkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                  Starting Turn: <span className="font-bold text-amber-600 dark:text-amber-400 uppercase">{game.startingColor === 'white' ? 'White' : 'Black'} to Move</span>
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
                      darkMode 
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' 
                        : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                    }`}
                    title="Flip Board View"
                    id="btn-puzzle-flip-board"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Flip Perspective</span>
                  </button>

                  {/* Theme Customizer Popup in Puzzle View */}
                  <div className="relative">
                    <button
                      onClick={() => setShowThemeSettings(!showThemeSettings)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                        showThemeSettings
                          ? 'bg-amber-600 text-white border-amber-600'
                          : darkMode 
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' 
                            : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                      }`}
                      title="Board & Piece Themes"
                      id="btn-puzzle-board-themes"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Theme</span>
                    </button>

                    {showThemeSettings && (
                      <div className={`absolute top-7 right-0 z-50 p-4 rounded-xl shadow-2xl border w-64 flex flex-col gap-3 text-left ${
                        darkMode ? 'bg-zinc-950 border-zinc-850 text-zinc-100' : 'bg-white border-stone-200 text-stone-800'
                      }`} id="puzzle-theme-settings-popover">
                        <div className="flex items-center justify-between pb-1.5 border-b border-stone-100 dark:border-zinc-900">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Board Customizer</span>
                          <button onClick={() => setShowThemeSettings(false)} className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-zinc-900 text-stone-400" id="btn-puzzle-close-theme-popover">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Board Theme */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Board Color</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'emerald', label: 'Emerald' },
                              { id: 'wood', label: 'Wood' },
                              { id: 'blue', label: 'Blue' },
                              { id: 'charcoal', label: 'Charcoal' },
                              { id: 'purple', label: 'Purple' }
                            ].map((b) => (
                              <button
                                key={b.id}
                                onClick={() => {
                                  setBoardTheme(b.id as any);
                                  localStorage.setItem('board_theme', b.id);
                                }}
                                className={`px-2 py-1 text-[10px] font-medium rounded border transition-all text-center ${
                                  boardTheme === b.id
                                    ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                                    : darkMode ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-400' : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-600'
                                }`}
                                id={`btn-puzzle-board-theme-${b.id}`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Piece Theme */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Piece Set</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'classic', label: 'Classic (Cburnett)' },
                              { id: 'alpha', label: 'Alpha' },
                              { id: 'merida', label: 'Merida' },
                              { id: 'cardinal', label: 'Cardinal' },
                              { id: 'governor', label: 'Governor' },
                              { id: 'dubrovny', label: 'Dubrovny' }
                            ].map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setPieceTheme(p.id as any);
                                  localStorage.setItem('piece_theme', p.id);
                                }}
                                className={`px-2 py-1 text-[10px] font-medium rounded border transition-all text-center ${
                                  pieceTheme === p.id
                                    ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                                    : darkMode ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-400' : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-600'
                                }`}
                                id={`btn-puzzle-piece-theme-${p.id}`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* The actual Chessground element */}
              <div className={`w-full aspect-square relative rounded-xl border border-stone-300 dark:border-zinc-800 bg-[#769656]/5 shadow-xl overflow-hidden theme-${boardTheme} piece-${pieceTheme}`}>
                <div ref={setBoardElement} className="w-full h-full" />
              </div>

              {/* Board indicators (like mistake count or status) */}
              <div className="flex items-center justify-between px-1 text-xs">
                <span className={`font-mono ${darkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                  Mistakes: <span className={`font-bold ${mistakeCount > 0 ? 'text-red-500' : 'text-stone-700 dark:text-zinc-300'}`}>{mistakeCount}</span>
                </span>
                {isOpponentThinking && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                    Opponent is thinking...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Puzzle Sidebar */}
          <div className={`w-full md:w-96 border-t md:border-t-0 md:border-l flex flex-col ${
            darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-stone-50/40 border-stone-200'
          }`} id="puzzle-notes-sidebar">
            
            {/* Header / Meta */}
            <div className="p-5 border-b border-stone-200 dark:border-zinc-800 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">🧩</span>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">Puzzle Solver</h3>
              </div>
              <p className={`text-xs leading-relaxed ${darkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                Test your skills! Drag and drop the pieces on the board to solve the puzzle.
              </p>
            </div>

            {/* Scrolling Body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              
              {/* Feedback Status Alert */}
              <div className={`p-4 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${
                puzzleState === 'solving'
                  ? darkMode ? 'bg-zinc-900/30 border-zinc-800 text-zinc-300' : 'bg-white border-stone-200 text-stone-700'
                  : puzzleState === 'correct-move'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    : puzzleState === 'failed'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {puzzleState === 'solving' ? '🤔' : puzzleState === 'correct-move' ? '✨' : puzzleState === 'failed' ? '❌' : '🎉'}
                  </span>
                  <span className="font-extrabold text-xs uppercase tracking-wider">
                    {puzzleState === 'solving'
                      ? isOpponentThinking ? 'Opponent Responding...' : 'Your Turn to Play'
                      : puzzleState === 'correct-move'
                        ? 'Correct Move!'
                        : puzzleState === 'failed'
                          ? 'Incorrect Move!'
                          : 'Puzzle Solved!'}
                  </span>
                </div>
                <p className="text-xs leading-normal">
                  {puzzleState === 'solving'
                    ? isOpponentThinking ? 'The opponent is making a move...' : `Find the best move for ${game.startingColor}! Play the correct piece movement on the board.`
                    : puzzleState === 'correct-move'
                      ? 'Excellent choice! That was the correct move. Now, find the next follow-up!'
                      : puzzleState === 'failed'
                        ? 'That move is incorrect in this position. Reset the puzzle or try a different approach!'
                        : 'Congratulations! You solved the puzzle perfectly.'}
                </p>
              </div>

              {/* Solved/Fail Banner & Theme Tags */}
              {game.themes && puzzleState === 'solved' && (
                <div className="flex flex-col gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                    Puzzle Tags & Themes
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {game.themes.split(/,\s*/).map((tag) => (
                      <span key={tag} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        darkMode ? 'bg-zinc-900 border border-zinc-800 text-zinc-400' : 'bg-stone-100 border border-stone-200/60 text-stone-600'
                      }`}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-250/50 dark:border-zinc-800/50 shrink-0">
                <button
                  type="button"
                  onClick={resetPuzzle}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-lg border border-stone-300 dark:border-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-900 text-stone-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                  id="btn-puzzle-reset"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  type="button"
                  disabled={puzzleState === 'solved'}
                  onClick={showHint}
                  className="flex-1 py-2 px-3 text-xs font-bold rounded-lg border border-stone-300 dark:border-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-900 text-stone-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  id="btn-puzzle-hint"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Show Hint
                </button>
              </div>

              {/* Manual Solve Status Override */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-stone-250/50 dark:border-zinc-800/50 shrink-0" id="manual-solve-status-panel">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                  Record Status
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateGame({ ...game, puzzleStatus: 'unsolved' })}
                    className={`text-[10px] font-bold py-1.5 rounded transition-colors text-center border ${
                      game.puzzleStatus === 'unsolved' || !game.puzzleStatus
                        ? 'bg-stone-200 text-stone-850 border-stone-350 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                        : 'bg-stone-100/40 text-stone-450 border-transparent hover:bg-stone-100 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:bg-zinc-900'
                    }`}
                  >
                    ⚪ Unsolved
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateGame({ ...game, puzzleStatus: 'solved' })}
                    className={`text-[10px] font-bold py-1.5 rounded transition-colors text-center border ${
                      game.puzzleStatus === 'solved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-350 dark:bg-emerald-955/50 dark:text-emerald-300 dark:border-emerald-900/40'
                        : 'bg-stone-100/40 text-stone-450 border-transparent hover:bg-stone-100 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:bg-zinc-900'
                    }`}
                  >
                    🟢 Solved
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateGame({ ...game, puzzleStatus: 'failed' })}
                    className={`text-[10px] font-bold py-1.5 rounded transition-colors text-center border ${
                      game.puzzleStatus === 'failed'
                        ? 'bg-rose-100 text-rose-800 border-rose-350 dark:bg-rose-955/50 dark:text-rose-300 dark:border-rose-900/40'
                        : 'bg-stone-100/40 text-stone-450 border-transparent hover:bg-stone-100 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:bg-zinc-900'
                    }`}
                  >
                    🔴 Failed
                  </button>
                </div>
              </div>

              {/* Give Up / Reveal Solution */}
              {!showScoresheetForce && puzzleState !== 'solved' && (
                <button
                  type="button"
                  onClick={() => setShowScoresheetForce(true)}
                  className="py-1.5 text-center text-[11px] font-semibold text-stone-500 hover:text-amber-500 dark:text-zinc-400 dark:hover:text-amber-400 hover:underline"
                >
                  Give Up / Reveal Move List
                </button>
              )}

              {/* Interactive Move List (Scoresheet) - Hidden until solved or revealed */}
              {(puzzleState === 'solved' || showScoresheetForce) && (
                <div className="flex flex-col gap-2 pt-3 border-t border-stone-250/50 dark:border-zinc-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-zinc-400' : 'text-stone-500'}`}>
                      Puzzle Move List
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Revealed
                    </span>
                  </div>

                  <div className={`p-3.5 rounded-lg border flex flex-col gap-2 font-mono text-xs ${
                    darkMode ? 'bg-zinc-900/40 border-zinc-800 text-zinc-300' : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`} id="puzzle-solution-moves">
                    <div className="grid grid-cols-12 gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 pb-1.5 border-b border-stone-200/60 dark:border-zinc-800/60 text-center">
                      <div className="col-span-2 text-left">Ply</div>
                      <div className="col-span-10 text-left">Notation Sequence</div>
                    </div>
                    {game.moves.map((m, idx) => {
                      const isWhite = idx % 2 === 0;
                      return (
                        <div key={m.id} className="grid grid-cols-12 gap-1 py-0.5 items-center">
                          <div className="col-span-2 text-stone-400 dark:text-zinc-600 text-[10px] font-semibold">
                            #{idx + 1}
                          </div>
                          <div className="col-span-10 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isWhite ? 'bg-white border border-stone-400' : 'bg-stone-900 border border-stone-950'}`}></span>
                            <span className="font-bold tracking-wide">{m.move}</span>
                            {m.comment && (
                              <span className="text-[10px] font-sans text-stone-400 dark:text-zinc-500">
                                ({m.comment})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row" id="workspace-layout">
        
        {/* Scoresheet Pane */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4" id="scoresheet-pane">
          
          {/* Header Legend */}
          <div className={`grid grid-cols-[3rem_1fr_1fr] gap-x-2 text-xs font-bold uppercase tracking-wider py-2 border-b ${
            darkMode ? 'text-zinc-500 border-zinc-800' : 'text-stone-500 border-stone-200'
          }`} id="scoresheet-column-headers">
            <div className="text-left font-mono text-[11px]">Round</div>
            <div className="flex items-center gap-1.5 text-left font-mono text-[11px]">
              <span className="w-2.5 h-2.5 bg-white border border-stone-450 dark:border-zinc-600 rounded-sm inline-block shrink-0"></span>
              White Move
            </div>
            <div className="flex items-center gap-1.5 text-left font-mono text-[11px]">
              <span className="w-2.5 h-2.5 bg-stone-900 border border-stone-950 dark:border-zinc-900 rounded-sm inline-block shrink-0"></span>
              Black Move
            </div>
          </div>

          {/* Move list empty state */}
          {game.moves.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
              <FileText className={`w-12 h-12 mb-4 ${darkMode ? 'text-zinc-800' : 'text-stone-200'}`} />
              <p className={`text-sm font-semibold ${darkMode ? 'text-zinc-300' : 'text-stone-700'}`}>Scoresheet is empty</p>
              <p className={`text-xs mt-1 max-w-sm leading-relaxed ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`}>
                Start typing moves below. The notation manager will automatically group and pair your White & Black moves.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-6">
                <button
                  onClick={handleToggleStartingColor}
                  className={`px-3 py-1.5 text-xs font-semibold border rounded-md transition-colors ${
                    darkMode
                      ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-zinc-300'
                      : 'bg-stone-100 border-stone-300 hover:bg-stone-200 text-stone-700'
                  }`}
                  id="btn-starting-color-empty-state"
                >
                  Start Game with: <span className="font-bold underline uppercase">{game.startingColor === 'white' ? 'White' : 'Black'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-mono scrollbar-thin" id="scoresheet-moves-container">
              {renderMoveTree(game.moves, game.startingColor, 1)}
              <div ref={scoresheetEndRef} />
            </div>
          )}
        </div>

        {/* Sidebar Tabs Pane */}
        {!hideRightSidebar && (
          <div className={`w-full md:w-96 border-t md:border-t-0 md:border-l flex flex-col ${
            darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-stone-50/40 border-stone-200'
          }`} id="editor-notes-sidebar">
            
            {/* Tabs Selector Header */}
            <div className={`grid grid-cols-3 text-center border-b font-semibold text-xs shrink-0 ${
              darkMode ? 'border-zinc-800' : 'border-stone-200'
            }`}>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-850 dark:hover:text-zinc-250'
                }`}
                id="tab-btn-notes"
              >
                General Notes
              </button>
              <button
                disabled={freestyleMode || !isPgnValid}
                onClick={() => !freestyleMode && isPgnValid && setActiveTab('board')}
                className={`py-3 transition-colors ${
                  (freestyleMode || !isPgnValid) ? 'opacity-40 cursor-not-allowed text-stone-400 dark:text-zinc-600' : 'cursor-pointer'
                } ${
                  activeTab === 'board'
                    ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-850 dark:hover:text-zinc-250'
                }`}
                title={freestyleMode ? "Chess Board disabled in Freestyle Mode" : !isPgnValid ? "Chess Board disabled for invalid PGN" : undefined}
                id="tab-btn-board"
              >
                Chess Board
              </button>
              <button
                disabled={freestyleMode || !isPgnValid}
                onClick={() => !freestyleMode && isPgnValid && setActiveTab('analysis')}
                className={`py-3 transition-colors ${
                  (freestyleMode || !isPgnValid) ? 'opacity-40 cursor-not-allowed text-stone-400 dark:text-zinc-600' : 'cursor-pointer'
                } ${
                  activeTab === 'analysis'
                    ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-850 dark:hover:text-zinc-250'
                }`}
                title={freestyleMode ? "Analysis Reports disabled in Freestyle Mode" : !isPgnValid ? "Analysis Reports disabled for invalid PGN" : undefined}
                id="tab-btn-analysis"
              >
                Analysis Reports ({game.analysisReports?.length || 0})
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              
              {/* Warning banner for invalid PGN */}
              {!isPgnValid && !freestyleMode && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-250 dark:border-red-900/40 rounded-lg text-xs text-red-700 dark:text-red-400 leading-normal flex items-start gap-2 animate-fade-in shrink-0">
                  <span className="text-sm shrink-0">⚠️</span>
                  <div>
                    <p className="font-bold">Invalid Move Sequence Detected</p>
                    <p className="mt-0.5">The game's PGN contains illegal or invalid moves. The interactive board and engine analysis have been disabled. You can review/edit notes or delete moves on the left to repair.</p>
                  </div>
                </div>
              )}
              
              {/* Informational banner for Freestyle Mode */}
              {freestyleMode && (
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-lg text-xs text-amber-850 dark:text-amber-450 leading-normal flex items-start gap-2 animate-fade-in shrink-0">
                  <span className="text-sm shrink-0">✨</span>
                  <div>
                    <p className="font-bold">Freestyle Note Taking Mode</p>
                    <p className="mt-0.5 text-[11px] opacity-90">You can record any chess moves (e.g., from puzzles or middle-game positions) without strict board rules or move validation. Turn off Freestyle Mode below if you want to use the interactive board and chess engine.</p>
                  </div>
                </div>
              )}
              
              {/* TAB 1: INTERACTIVE CHESS BOARD PREVIEW */}
              {activeTab === 'board' && (
                <div className="flex flex-col gap-3" id="tab-board-content">
                  
                  <div className="flex gap-2 w-full items-stretch" id="chessboard-and-eval-layout">
                    {/* Vertical Evaluation Bar */}
                    {isEngineActive && !isEngineLoading && (
                      <div className="w-3 rounded-md overflow-hidden bg-zinc-800 dark:bg-zinc-950 flex flex-col relative border border-stone-300 dark:border-zinc-800 shrink-0 shadow-sm" title={`Engine evaluation: ${engineEval}`}>
                        {/* Visual evaluation representation: height of White is proportional to score */}
                        <div 
                          className="bg-white transition-all duration-300 ease-out"
                          style={{ 
                            height: `${Math.max(5, Math.min(95, 50 + (engineCentipawns * 8)))}%` 
                          }}
                        />
                        <div className="flex-1 bg-stone-900 transition-all duration-300 ease-out" />
                        
                        {/* Evaluation Score Text */}
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-[8px] font-extrabold mix-blend-difference text-white" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                          {engineEval}
                        </span>
                      </div>
                    )}

                    {/* Interactive Chessground Board */}
                    <div className={`flex-1 relative aspect-square rounded-xl border border-stone-300 dark:border-zinc-800 bg-[#769656]/5 shadow-xl overflow-hidden animate-fade-in theme-${boardTheme} piece-${pieceTheme}`}>
                      <div ref={setPreviewBoardElement} className="w-full h-full" />
                    </div>
                    {/* Chessboard container with coordinates */}
                    <div className="hidden">
                      <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
                      {displayedRanks.map((rank, rIdx) => {
                        const trueRowIdx = isFlipped ? rank - 1 : 8 - rank;
                        return displayedFiles.map((file, fIdx) => {
                          const trueColIdx = isFlipped ? 104 - file.charCodeAt(0) : file.charCodeAt(0) - 97;
                          
                          const squarePiece = activeBoard[trueRowIdx]?.[trueColIdx];
                          const isDarkSquare = (trueRowIdx + trueColIdx) % 2 === 1;
                          const squareName = `${file}${rank}`;
                          const isBestMoveStart = engineBestMove && engineBestMove.slice(0, 2) === squareName;
                          const isBestMoveEnd = engineBestMove && engineBestMove.slice(2, 4) === squareName;

                          // Dynamic coordinate rendering rules
                          const showRankLabel = fIdx === 0;
                          const showFileLabel = rIdx === 7;

                          return (
                            <div
                              key={`${file}${rank}`}
                              className={`aspect-square flex items-center justify-center relative select-none font-sans ${
                                isDarkSquare 
                                  ? 'bg-[#769656]' // iconic chess.com forest green
                                  : 'bg-[#eeeed2]' // iconic chess.com warm cream
                              }`}
                            >
                              {/* Best move highlight overlays */}
                              {isBestMoveStart && (
                                <div className="absolute inset-0 bg-blue-500/25 mix-blend-multiply pointer-events-none" title="Stockfish best move start square" />
                              )}
                              {isBestMoveEnd && (
                                <div className="absolute inset-0 bg-blue-400/35 mix-blend-multiply pointer-events-none flex items-center justify-center" title="Stockfish best move target square">
                                  <div className="w-3.5 h-3.5 rounded-full bg-blue-600/60 border border-white/40" />
                                </div>
                              )}

                              {/* Piece icon */}
                              {squarePiece && (
                                <span className={`text-3xl sm:text-4xl select-none transition-transform duration-100 ${
                                  squarePiece.color === 'w' 
                                    ? 'text-zinc-50 drop-shadow-[0_2.5px_2px_rgba(0,0,0,0.85)]' 
                                    : 'text-stone-900 drop-shadow-[0_1.5px_1px_rgba(255,255,255,0.45)]'
                                }`}>
                                  {PIECE_SYMBOLS[squarePiece.type]}
                                </span>
                              )}

                              {/* Rank label (1-8) */}
                              {showRankLabel && (
                                <span className={`absolute top-0.5 left-1 text-[9px] font-bold leading-none select-none ${
                                  isDarkSquare ? 'text-[#eeeed2]' : 'text-[#769656]'
                                }`}>
                                  {rank}
                                </span>
                              )}

                              {/* File label (a-h) */}
                              {showFileLabel && (
                                <span className={`absolute bottom-0.5 right-1 text-[9px] font-bold leading-none select-none ${
                                  isDarkSquare ? 'text-[#eeeed2]' : 'text-[#769656]'
                                }`}>
                                  {file}
                                </span>
                              )}
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>
                  </div>

                  {/* Navigation Buttons Row */}
                  <div className="flex items-center justify-center gap-1 py-1.5 border-b dark:border-zinc-800" id="board-navigation-toolbar">
                    <button
                      onClick={() => setCurrentPlyIndex(0)}
                      disabled={currentPlyIndex === 0}
                      className={`p-2 rounded-lg transition-colors ${
                        darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      } disabled:opacity-45 disabled:pointer-events-none`}
                      title="First Move (0)"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToPreviousPly}
                      disabled={currentPlyIndex === 0}
                      className={`p-2 rounded-lg transition-colors ${
                        darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      } disabled:opacity-45 disabled:pointer-events-none`}
                      title="Previous Move"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Autoplay Play/Pause */}
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`p-2 px-4 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm ${
                        isPlaying 
                          ? 'bg-amber-600 text-white hover:bg-amber-500' 
                          : darkMode 
                            ? 'bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800' 
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-850 border border-stone-200'
                      }`}
                      title={isPlaying ? "Pause autoplay loop" : "Autoplay move transition"}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? 'Pause' : 'Play'}</span>
                    </button>

                    <button
                      onClick={goToNextPly}
                      disabled={currentPlyIndex === activeLine.length}
                      className={`p-2 rounded-lg transition-colors ${
                        darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      } disabled:opacity-45 disabled:pointer-events-none`}
                      title="Next Move"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPlyIndex(activeLine.length)}
                      disabled={currentPlyIndex === activeLine.length}
                      className={`p-2 rounded-lg transition-colors ${
                        darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      } disabled:opacity-45 disabled:pointer-events-none`}
                      title="Latest Position"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                     <button
                      onClick={() => setIsFlipped(!isFlipped)}
                      className={`p-2 rounded-lg transition-colors ml-1.5 ${
                        darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                      }`}
                      title="Flip Board View"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Theme Customizer Popup */}
                    <div className="relative">
                      <button
                        onClick={() => setShowThemeSettings(!showThemeSettings)}
                        className={`p-2 rounded-lg transition-colors ml-1 ${
                          showThemeSettings
                            ? 'bg-amber-600 text-white'
                            : darkMode ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                        }`}
                        title="Board & Piece Themes"
                        id="btn-board-themes"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>

                      {showThemeSettings && (
                        <div className={`absolute bottom-10 right-0 z-50 p-4 rounded-xl shadow-2xl border w-64 flex flex-col gap-3 text-left ${
                          darkMode ? 'bg-zinc-950 border-zinc-850 text-zinc-100' : 'bg-white border-stone-200 text-stone-800'
                        }`} id="theme-settings-popover">
                          <div className="flex items-center justify-between pb-1.5 border-b border-stone-100 dark:border-zinc-900">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Board Customizer</span>
                            <button onClick={() => setShowThemeSettings(false)} className="p-0.5 rounded hover:bg-stone-100 dark:hover:bg-zinc-900 text-stone-400" id="btn-close-theme-popover">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Board Theme */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Board Color</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { id: 'emerald', label: 'Emerald' },
                                { id: 'wood', label: 'Wood' },
                                { id: 'blue', label: 'Blue' },
                                { id: 'charcoal', label: 'Charcoal' },
                                { id: 'purple', label: 'Purple' }
                              ].map((b) => (
                                <button
                                  key={b.id}
                                  onClick={() => {
                                    setBoardTheme(b.id as any);
                                    localStorage.setItem('board_theme', b.id);
                                  }}
                                  className={`px-2 py-1 text-[10px] font-medium rounded border transition-all text-center ${
                                    boardTheme === b.id
                                      ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                                      : darkMode ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-400' : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-600'
                                  }`}
                                  id={`btn-board-theme-${b.id}`}
                                >
                                  {b.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Piece Theme */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Piece Set</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { id: 'classic', label: 'Classic (Cburnett)' },
                                { id: 'alpha', label: 'Alpha' },
                                { id: 'merida', label: 'Merida' },
                                { id: 'cardinal', label: 'Cardinal' },
                                { id: 'governor', label: 'Governor' },
                                { id: 'dubrovny', label: 'Dubrovny' }
                              ].map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setPieceTheme(p.id as any);
                                    localStorage.setItem('piece_theme', p.id);
                                  }}
                                  className={`px-2 py-1 text-[10px] font-medium rounded border transition-all text-center ${
                                    pieceTheme === p.id
                                      ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400'
                                      : darkMode ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-400' : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-600'
                                  }`}
                                  id={`btn-piece-theme-${p.id}`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Position Details & Material Balance */}
                  <div className={`p-3 rounded-lg border text-xs flex flex-col gap-2 ${
                    darkMode ? 'bg-zinc-900/40 border-zinc-800' : 'bg-stone-50 border-stone-200'
                  }`} id="board-preview-metadata">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-500 dark:text-zinc-500">Preview State:</span>
                      <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                        {currentPlyIndex === 0 
                          ? 'Initial Setup' 
                          : `Ply #${currentPlyIndex} / Move ${Math.ceil(currentPlyIndex / 2)}`
                        }
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-500 dark:text-zinc-500">Material Balance:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                        materialBalance.diff === 0
                          ? 'bg-stone-100 text-stone-800 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-750'
                          : materialBalance.diff > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25'
                      }`}>
                        {materialBalance.diff === 0 
                          ? 'Equal Material' 
                          : materialBalance.diff > 0 
                            ? `White is up +${materialBalance.diff}` 
                            : `Black is up +${Math.abs(materialBalance.diff)}`
                        }
                      </span>
                    </div>

                    {currentPlyIndex > 0 && game.moves[currentPlyIndex - 1] && (
                      <div className="border-t pt-1.5 mt-0.5 text-[11px] leading-relaxed italic text-stone-600 dark:text-zinc-400">
                        <span className="font-bold not-italic font-mono text-amber-500 mr-1.5">Last move:</span>
                        "{game.moves[currentPlyIndex - 1].move}" 
                        {game.moves[currentPlyIndex - 1].comment && (
                          <span className="text-amber-600 dark:text-amber-400"> — {game.moves[currentPlyIndex - 1].comment}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stockfish Engine Card */}
                  <div className={`p-3.5 rounded-lg border flex flex-col gap-2.5 transition-all ${
                    darkMode ? 'bg-zinc-900/40 border-zinc-800' : 'bg-stone-50 border-stone-300'
                  }`} id="stockfish-engine-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Cpu className={`w-4 h-4 ${isEngineActive ? 'text-amber-500 animate-pulse' : 'text-stone-400 dark:text-zinc-500'}`} />
                        <span className="font-bold text-xs">Stockfish 18 Engine</span>
                      </div>
                      
                      {isEngineLoading ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-semibold">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                          <span>Downloading...</span>
                        </div>
                      ) : (
                        <button
                          onClick={isEngineActive ? stopEngine : startEngine}
                          className={`text-[10px] font-bold py-1 px-2.5 rounded transition-colors ${
                            isEngineActive
                              ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
                              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                          }`}
                        >
                          {isEngineActive ? 'Turn Off' : 'Turn On'}
                        </button>
                      )}
                    </div>

                    {isEngineActive && (
                      <div className="flex flex-col gap-2 pt-1 border-t border-stone-200 dark:border-zinc-800/80">
                        {/* Eval details */}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex flex-col">
                            <span className="text-stone-500 dark:text-zinc-500 font-semibold">Evaluation:</span>
                            <span className="font-mono font-bold text-sm text-amber-500 mt-0.5">{engineEval}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-stone-500 dark:text-zinc-500 font-semibold">Search Depth:</span>
                            <span className="font-mono font-bold text-stone-700 dark:text-zinc-300 mt-0.5">d = {engineDepth}</span>
                          </div>
                        </div>

                        {/* PV Continuation */}
                        {enginePv && (
                          <div className="flex flex-col gap-1 bg-white dark:bg-zinc-950 p-2 rounded border border-stone-200 dark:border-zinc-850">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Suggested Continuation (PV):</span>
                            <span className="font-mono text-[10px] text-stone-800 dark:text-zinc-300 break-words font-semibold leading-relaxed">
                              {enginePv.split(' ').slice(0, 5).join(' ')}...
                            </span>
                          </div>
                        )}

                        {/* Best Move */}
                        {engineBestMove && (
                          <div className="flex flex-col gap-1 bg-white dark:bg-zinc-950 p-2 rounded border border-stone-200 dark:border-zinc-850">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Recommended Best Move:</span>
                            <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> {engineBestMove}
                            </span>
                          </div>
                        )}

                        {/* Generate Report Quick Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setReportTitle(`Stockfish Analysis at Ply #${currentPlyIndex}`);
                            setReportEval(`${engineEval} Stockfish (d=${engineDepth})`);
                            setReportNotes(`Position evaluated at depth ${engineDepth} with recommended move sequence. Best line (PV): ${enginePv || 'N/A'}`);
                            setReportMistakes(engineBestMove ? `Suggested Best Move is ${engineBestMove}` : 'None analyzed');
                            setReportConclusion(engineEval.includes('+') ? 'White has positional advantage.' : engineEval.includes('-') ? 'Black has positional advantage.' : 'Position is dynamically balanced or equal.');
                            setIsAddingReport(true);
                            setActiveTab('analysis');
                          }}
                          className="mt-1 w-full py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
                          Create Analysis Report
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ANALYSIS REPORTS SECTION */}
              {activeTab === 'analysis' && (
                <div className="flex flex-col gap-3" id="tab-analysis-content">
                  
                  {/* Add Report Toggle Button */}
                  {!isAddingReport ? (
                    <button
                      onClick={() => setIsAddingReport(true)}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-amber-900/10"
                      id="btn-trigger-add-report"
                    >
                      <Plus className="w-4 h-4" />
                      Add Position Report (At Ply #{currentPlyIndex})
                    </button>
                  ) : (
                    /* Structured Report Form */
                    <form onSubmit={handleSaveReport} className={`p-4 rounded-lg border flex flex-col gap-3.5 ${
                      darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-stone-50 border-stone-300'
                    }`} id="add-report-form">
                      
                      <div className="flex items-center justify-between border-b pb-1.5 border-stone-200 dark:border-zinc-800">
                        <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" />
                          New Position Report
                        </h4>
                        <div className="flex items-center gap-1.5">
                          {isEngineActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setReportTitle(`Stockfish Analysis at Ply #${currentPlyIndex}`);
                                setReportEval(`${engineEval} Stockfish (d=${engineDepth})`);
                                setReportNotes(`Position evaluated at depth ${engineDepth} with recommended move sequence. Best line (PV): ${enginePv || 'N/A'}`);
                                setReportMistakes(engineBestMove ? `Suggested Best Move is ${engineBestMove}` : 'None analyzed');
                                setReportConclusion(engineEval.includes('+') ? 'White has positional advantage.' : engineEval.includes('-') ? 'Black has positional advantage.' : 'Position is dynamically balanced or equal.');
                              }}
                              className="text-[9px] text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                              title="Auto-fill report from Stockfish"
                            >
                              <Zap className="w-2.5 h-2.5 animate-pulse text-amber-500" /> Auto-Fill
                            </button>
                          )}
                          <span className="text-[10px] font-mono font-bold bg-stone-200 dark:bg-zinc-800 px-1.5 py-0.2 rounded text-stone-600 dark:text-zinc-400">
                            Ply #{currentPlyIndex}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wide">Report Title / Theme</label>
                        <input
                          type="text"
                          required
                          value={reportTitle}
                          onChange={(e) => setReportTitle(e.target.value)}
                          placeholder="e.g. King safety flaw, blundered knight"
                          className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                            darkMode
                              ? 'bg-zinc-950 border-zinc-800 text-white focus:border-zinc-700'
                              : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
                          }`}
                          id="report-input-title"
                        />
                      </div>

                      {/* Evaluation select */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wide flex items-center justify-between">
                          <span>Evaluation Assessment</span>
                          {isEngineActive && (
                            <button
                              type="button"
                              onClick={() => {
                                setReportEval(`${engineEval} Stockfish (d=${engineDepth})`);
                              }}
                              className="text-[9px] text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-0.5 normal-case"
                            >
                              <Zap className="w-2.5 h-2.5" /> Use Engine Eval ({engineEval})
                            </button>
                          )}
                        </label>
                        <input
                          type="text"
                          required
                          value={reportEval}
                          onChange={(e) => setReportEval(e.target.value)}
                          placeholder="e.g. +0.75, equal, mate in 3"
                          className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                            darkMode
                              ? 'bg-zinc-950 border-zinc-800 text-white focus:border-zinc-700'
                              : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
                          }`}
                          id="report-input-eval"
                        />
                      </div>

                      {/* Strategic Notes */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wide">Strategic Position Analysis</label>
                        <textarea
                          required
                          value={reportNotes}
                          onChange={(e) => setReportNotes(e.target.value)}
                          placeholder="Describe pawn structures, pieces activity, space advantages, positional plans, or threats..."
                          className={`px-3 py-1.5 text-xs rounded-md outline-none border resize-none h-20 ${
                            darkMode
                              ? 'bg-zinc-950 border-zinc-800 text-white focus:border-zinc-700'
                              : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
                          }`}
                          id="report-input-notes"
                        />
                      </div>

                      {/* Tactical Mistakes (Optional) */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wide">Tactical Mistakes / Blunders (Optional)</label>
                        <input
                          type="text"
                          value={reportMistakes}
                          onChange={(e) => setReportMistakes(e.target.value)}
                          placeholder="e.g. missed Bxf7+ tactic, blunder of e5 pawn"
                          className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                            darkMode
                              ? 'bg-zinc-950 border-zinc-800 text-white focus:border-zinc-700'
                              : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
                          }`}
                          id="report-input-mistakes"
                        />
                      </div>

                      {/* Key Takeaway (Optional) */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wide">Main Takeaway / Conclusion (Optional)</label>
                        <input
                          type="text"
                          value={reportConclusion}
                          onChange={(e) => setReportConclusion(e.target.value)}
                          placeholder="e.g. must avoid early queen development"
                          className={`px-3 py-1.5 text-xs rounded-md outline-none border ${
                            darkMode
                              ? 'bg-zinc-950 border-zinc-800 text-white focus:border-zinc-700'
                              : 'bg-white border-stone-300 text-stone-900 focus:border-stone-400'
                          }`}
                          id="report-input-conclusion"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5 border-t pt-2 border-stone-200 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setIsAddingReport(false)}
                          className={`py-1.5 px-3 text-xs rounded-md border transition-all ${
                            darkMode
                              ? 'bg-zinc-950 border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200'
                              : 'bg-white border-stone-300 hover:bg-stone-100 text-stone-600'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-md transition-all shadow-sm"
                        >
                          Save Report
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Reports List */}
                  <div className="flex flex-col gap-2.5 mt-1" id="analysis-reports-scroller">
                    {(!game.analysisReports || game.analysisReports.length === 0) ? (
                      <div className="text-center py-8 text-stone-400 dark:text-zinc-600">
                        <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-55 text-amber-500" />
                        <p className="text-xs font-medium">No saved position reports yet</p>
                        <p className="text-[10px] mt-1 max-w-xs mx-auto leading-normal">
                          Navigate to any move on the board, and add annotated reports cards with dynamic ratings, blunders, and strategic study notes.
                        </p>
                      </div>
                    ) : (
                      game.analysisReports.map((rep) => {
                        return (
                          <div
                            key={rep.id}
                            className={`p-3.5 rounded-lg border relative group transition-all cursor-pointer ${
                              darkMode 
                                ? 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-750 hover:bg-zinc-900' 
                                : 'bg-stone-50 border-stone-200 hover:border-stone-300 hover:bg-stone-50/80'
                            }`}
                            onClick={() => setCurrentPlyIndex(rep.plyIndex)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs truncate max-w-[160px]">{rep.title}</span>
                                <span className={`text-[8px] font-bold py-0.2 px-1.5 rounded-full ${
                                  rep.plyIndex === 0 
                                    ? 'bg-stone-200 text-stone-700' 
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  Ply #{rep.plyIndex}
                                </span>
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReport(rep.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-950/25 rounded text-stone-400 hover:text-red-500 transition-all absolute right-2 top-2"
                                title="Delete Report Card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                rep.evaluation.includes('+')
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-400'
                                  : rep.evaluation.includes('-')
                                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-400'
                                    : 'bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}>
                                {rep.evaluation}
                              </span>
                              <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-sans">{rep.timestamp}</span>
                            </div>

                            <p className="text-[11px] text-stone-600 dark:text-zinc-400 mt-2 leading-relaxed">
                              {rep.strategicNotes}
                            </p>

                            {rep.tacticalMistakes && (
                              <div className="text-[10px] mt-1.5 leading-normal bg-rose-50/50 dark:bg-rose-950/15 p-1 px-2 rounded border border-rose-100 dark:border-rose-950/30 text-rose-700 dark:text-rose-400">
                                <span className="font-bold">Blunders/Tactics:</span> {rep.tacticalMistakes}
                              </div>
                            )}

                            {rep.conclusion && (
                              <div className="text-[10px] mt-1 bg-stone-100 dark:bg-zinc-800/40 p-1 px-2 rounded text-stone-600 dark:text-zinc-300">
                                <span className="font-bold text-amber-600 dark:text-amber-400">Takeaway:</span> {rep.conclusion}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: GENERAL NOTES */}
              {activeTab === 'notes' && (
                <div className="flex flex-col gap-4 h-full" id="tab-notes-content">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-500" />
                      Game Notes
                    </h3>
                    
                    <button
                      onClick={handleToggleStartingColor}
                      className={`text-[10px] font-semibold py-0.5 px-2 rounded border transition-colors ${
                        darkMode
                          ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-400 hover:text-white'
                          : 'bg-white hover:bg-stone-100 border-stone-200 text-stone-600 hover:text-stone-900'
                      }`}
                      title="Toggle starting move color"
                    >
                      Starts: <span className="underline font-bold uppercase">{game.startingColor}</span>
                    </button>
                  </div>

                  {/* Puzzle / Custom Setup Info Card */}
                  {(game.initialFen || game.themes || game.site) && (
                    <div className={`p-3 rounded-lg border text-xs leading-normal shrink-0 ${
                      darkMode ? 'bg-amber-500/5 border-amber-500/20 text-zinc-300' : 'bg-amber-50/50 border-amber-500/20 text-stone-700'
                    }`} id="puzzle-details-card">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base">🧩</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">Puzzle & Custom Setup Details</span>
                      </div>
                      <div className="space-y-1.5 font-sans">
                        {game.initialFen && (
                          <div className="flex items-center gap-2 mt-1 mb-2">
                            <span className="font-semibold text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 w-12 shrink-0">Solve Status:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onUpdateGame({ ...game, puzzleStatus: 'unsolved' })}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                  game.puzzleStatus === 'unsolved' || !game.puzzleStatus
                                    ? 'bg-stone-200 text-stone-850 border border-stone-350 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                                    : 'bg-stone-100/40 text-stone-450 hover:bg-stone-100 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:bg-zinc-900'
                                }`}
                              >
                                ⚪ Unsolved
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateGame({ ...game, puzzleStatus: 'solved' })}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                  game.puzzleStatus === 'solved'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-350 dark:bg-emerald-955/50 dark:text-emerald-300 dark:border-emerald-900/40'
                                    : 'bg-stone-100/40 text-stone-450 hover:bg-stone-100 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:bg-zinc-900'
                                }`}
                              >
                                🟢 Solved
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateGame({ ...game, puzzleStatus: 'failed' })}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                                  game.puzzleStatus === 'failed'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-350 dark:bg-rose-955/50 dark:text-rose-300 dark:border-rose-900/40'
                                    : 'bg-stone-100/40 text-stone-450 hover:bg-stone-100 dark:bg-zinc-900/30 dark:text-zinc-500 dark:hover:bg-zinc-900'
                                }`}
                              >
                                🔴 Failed
                              </button>
                            </div>
                          </div>
                        )}
                        {game.site && (
                          <p className="flex items-start gap-1">
                            <span className="font-semibold text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 w-12 pt-0.5">Source:</span>
                            {game.site.startsWith('http') ? (
                              <a href={game.site} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 hover:underline break-all">
                                {game.site}
                              </a>
                            ) : (
                              <span className="break-all">{game.site}</span>
                            )}
                          </p>
                        )}
                        {game.initialFen && (
                          <div className="flex items-start gap-1">
                            <span className="font-semibold text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 w-12 pt-0.5">FEN:</span>
                            <span className="font-mono text-[11px] bg-stone-100 dark:bg-zinc-900 p-1 rounded border border-stone-200/50 dark:border-zinc-800/50 break-all select-all flex-1 text-stone-600 dark:text-zinc-400">
                              {game.initialFen}
                            </span>
                          </div>
                        )}
                        {game.themes && (!game.initialFen || puzzleState === 'solved') && (
                          <div className="flex items-start gap-1">
                            <span className="font-semibold text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 w-12 pt-0.5">Themes:</span>
                            <div className="flex flex-wrap gap-1">
                              {game.themes.split(/,\s*/).map((theme) => (
                                <span key={theme} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  darkMode ? 'bg-zinc-850 border border-zinc-800 text-zinc-400' : 'bg-stone-100 border border-stone-200/60 text-stone-600'
                                }`}>
                                  {theme}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <textarea
                    value={game.notes || ''}
                    onChange={(e) => onUpdateGame({ ...game, notes: e.target.value })}
                    spellCheck="false"
                    placeholder="Jot down general annotations, opening lines, physical board comments, or positional analysis here..."
                    className={`w-full min-h-[220px] p-3 text-xs rounded-lg outline-none border resize-none leading-relaxed transition-all ${
                      darkMode
                        ? 'bg-zinc-900 border-zinc-800 focus:border-zinc-700 text-zinc-100 placeholder-zinc-650'
                        : 'bg-white border-stone-200 focus:border-stone-400 text-stone-900 placeholder-stone-400'
                    }`}
                    id="game-notes-textarea"
                  />

                  {/* General notation tips */}
                  <div className={`p-3 rounded-lg border text-[11px] leading-normal ${
                    darkMode ? 'bg-zinc-900/50 border-zinc-800/60 text-zinc-500' : 'bg-stone-100 border-stone-200 text-stone-500'
                  }`} id="notes-tips-container">
                    <p className="font-bold mb-1">💡 Scoresheet Cheat Sheet:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Press <kbd className="font-bold">Space</kbd> or <kbd className="font-bold">Enter</kbd> to rapidly log moves.</li>
                      <li>Press <kbd className="font-bold">Up Arrow</kbd> inside the move input to edit previously logged moves.</li>
                      <li>Click any logged move to edit it inline, add Commentary, or Truncate subsequent plies.</li>
                    </ul>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
      )}

      {/* Rapid Move Input Bar */}
      {!isPuzzleActive && (
        <div className={`p-4 border-t flex flex-col gap-2 shrink-0 ${
          darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-stone-200 bg-stone-50'
        }`} id="rapid-input-container">
        
        {/* Freestyle toggle & error status row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-1">
          <div>
            {moveValidationError ? (
              <div className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5 animate-fade-in">
                <span>⚠️ {moveValidationError}</span>
              </div>
            ) : (
              <div className={`text-[11px] font-medium ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                {freestyleMode ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    ✨ Freestyle Mode Active (Legality checks off, board not loaded)
                  </span>
                ) : (
                  <span className="text-stone-600 dark:text-zinc-400 font-semibold">
                    Strict Chess Mode Active (Valid position rules apply)
                  </span>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none self-end sm:self-auto">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              darkMode ? 'text-zinc-400' : 'text-stone-600'
            }`}>
              Freestyle Mode
            </span>
            <div className="relative w-8 h-4.5">
              <input
                type="checkbox"
                checked={freestyleMode}
                onChange={(e) => {
                  const val = e.target.checked;
                  setFreestyleMode(val);
                  if (val) {
                    setActiveTab('notes');
                  }
                }}
                className="sr-only peer"
              />
              <div className={`w-8 h-4.5 rounded-full transition-colors ${
                darkMode ? 'bg-zinc-850 peer-checked:bg-amber-500 border border-zinc-800' : 'bg-stone-200 peer-checked:bg-amber-500'
              } after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5`}></div>
            </div>
          </label>
        </div>
        
        {editingHistoryIndex !== null && (
          <div className="text-xs text-amber-800 dark:text-amber-300 font-semibold px-2 py-1.5 flex items-center justify-between gap-1.5 animate-fade-in bg-amber-500/10 dark:bg-amber-500/5 rounded border border-amber-500/20 mb-1">
            <span className="flex items-center gap-1">
              ✏️ Editing Move #{editingHistoryIndex + 1} ({Math.floor(editingHistoryIndex / 2) + 1}.{editingHistoryIndex % 2 === 0 ? '' : '..'} {game.moves[editingHistoryIndex].move})
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingHistoryIndex(null);
                setMoveInput(tempInputText);
              }}
              className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 hover:underline"
            >
              Cancel (Esc)
            </button>
          </div>
        )}

        <form onSubmit={handleMoveInputSubmit} className="flex items-center gap-2">
          {/* Turn Indicator Dot */}
          <div className="flex items-center gap-2 shrink-0 px-1.5">
            <span className={`relative flex h-2.5 w-2.5`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isWhitesTurn() ? 'bg-amber-400' : 'bg-stone-900 dark:bg-stone-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isWhitesTurn() ? 'bg-amber-500' : 'bg-stone-950 dark:bg-stone-200'
              }`}></span>
            </span>
            <span className={`text-[11px] font-bold tracking-tight uppercase ${
              darkMode ? 'text-zinc-400' : 'text-stone-600'
            }`}>
              {isWhitesTurn() ? 'White' : 'Black'} to move <span className="font-mono text-amber-500">[{getCurrentMoveNumber()}]</span>
            </span>
          </div>

          {/* Move Input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={moveInput}
              onChange={(e) => setMoveInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              autoCorrect="off"
              autoComplete="off"
              autoCapitalize="off"
              placeholder='Type move (e.g. "e4", "Nf3", "O-O", "Bxf7+") and press Space or Enter...'
              className={`w-full pl-3 pr-20 py-2.5 text-xs font-mono rounded-lg border outline-none transition-all ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 focus:border-amber-500/50 text-white placeholder-zinc-650'
                  : 'bg-white border-stone-300 focus:border-stone-400 text-stone-900 placeholder-stone-400'
              }`}
              id="rapid-move-text-input"
            />
            
            {/* Quick keys badge */}
            <div className="absolute right-2.5 top-2 flex items-center gap-1 shrink-0">
              <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-sans ${
                darkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-stone-100 text-stone-400'
              }`}>
                <CornerDownLeft className="w-2.5 h-2.5" /> Space / Enter
              </span>
            </div>
          </div>

          {/* Undo & Redo Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleUndoLastMove}
              disabled={undoHistory.length === 0 && game.moves.length === 0}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white'
                  : 'bg-white border-stone-300 hover:bg-stone-100 text-stone-600 hover:text-stone-900'
              } disabled:opacity-40 disabled:pointer-events-none`}
              title="Delete last move (Backspace on empty input)"
              id="btn-undo-last-move"
            >
              <Undo className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Undo</span>
            </button>

            <button
              type="button"
              onClick={handleRedoLastMove}
              disabled={redoHistory.length === 0}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                darkMode
                  ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white'
                  : 'bg-white border-stone-300 hover:bg-stone-100 text-stone-600 hover:text-stone-900'
              } disabled:opacity-40 disabled:pointer-events-none`}
              title="Restore last deleted move"
              id="btn-redo-last-move"
            >
              <Redo className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Redo</span>
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Export PGN Modal Overlay */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="export-pgn-modal">
          <div className={`w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden ${
            darkMode ? 'bg-zinc-950 border-zinc-850' : 'bg-white border-stone-250'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              darkMode ? 'border-zinc-850 bg-zinc-950/40' : 'border-stone-150 bg-stone-50/50'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">📁</span>
                <h3 className="text-sm font-extrabold text-amber-600 dark:text-amber-400">Portable Game Notation (PGN) Export</h3>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-zinc-900 text-zinc-400 hover:text-white' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
                }`}
                id="btn-close-export-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <p className={`text-xs leading-normal ${darkMode ? 'text-zinc-400' : 'text-stone-600'}`}>
                Below is the standard Portable Game Notation (PGN) scorebook for <strong className="text-amber-500">"{game.title}"</strong>. You can copy it directly to your clipboard or download it as a standard `.pgn` file.
              </p>

              {/* Text Area Viewer */}
              <div className="relative">
                <textarea
                  readOnly
                  value={exportedPgnText}
                  className={`w-full h-72 p-4 font-mono text-[11px] leading-relaxed rounded-lg border outline-none resize-none ${
                    darkMode
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200'
                      : 'bg-stone-50 border-stone-250 text-stone-850'
                  }`}
                  id="export-pgn-text-viewer"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                
                {/* Copy overlay button */}
                <button
                  onClick={handleCopyPgnToClipboard}
                  className={`absolute right-3 top-3 flex items-center gap-1.5 py-1 px-2.5 rounded text-[10px] font-bold border shadow-sm transition-all ${
                    isCopied
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : darkMode
                        ? 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-amber-400'
                        : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                  id="btn-copy-pgn"
                >
                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopied ? 'Copied!' : 'Copy PGN'}</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-end gap-2.5 ${
              darkMode ? 'bg-zinc-950/40 border-zinc-850' : 'bg-stone-50/50 border-stone-150'
            }`}>
              <button
                onClick={() => setShowExportModal(false)}
                className={`py-2 px-4 rounded-lg border text-xs font-semibold transition-all ${
                  darkMode
                    ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white'
                    : 'bg-white border-stone-300 hover:bg-stone-100 text-stone-650'
                }`}
                id="btn-cancel-export-modal"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPgnFile}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-900/10"
                id="btn-download-pgn"
              >
                <Download className="w-4 h-4" />
                <span>Download .PGN File</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
