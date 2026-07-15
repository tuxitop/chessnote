export interface MovePly {
  id: string;
  move: string;      // e.g. "e4", "Nf3"
  comment?: string;  // optional comment for this specific move
  variations?: MovePly[][]; // List of alternative variation lines starting at this ply's index
}

export interface AnalysisReport {
  id: string;
  title: string;             // Theme / heading of the report
  plyIndex: number;          // At which ply was this report written
  evaluation: string;        // e.g. "Equal", "Advantage White", "+1.5", etc.
  strategicNotes: string;    // Core written analysis
  tacticalMistakes?: string;  // Mistakes/improvements
  conclusion?: string;        // Final takeaways
  timestamp: string;         // Date string
}

export interface Game {
  id: string;
  title: string;
  date: string;               // YYYY-MM-DD
  startingColor: 'white' | 'black';
  moves: MovePly[];           // Flat list of plies
  notes?: string;             // General notes for the game
  event?: string;             // PGN Event tag
  site?: string;              // PGN Site tag
  whitePlayer?: string;       // White player name
  blackPlayer?: string;       // Black player name
  result?: string;            // "*", "1-0", "0-1", "1/2-1/2"
  initialFen?: string;        // Starting custom board FEN position (e.g. for Puzzles / setups)
  themes?: string;            // Puzzle themes if imported
  puzzleStatus?: 'solved' | 'failed' | 'unsolved'; // Puzzle solve status
  analysisReports?: AnalysisReport[]; // List of saved position/game reports
  starred?: boolean;          // star status
  tags?: string[];            // tags
}

export interface Folder {
  id: string;
  name: string;               // e.g. "2026-07-07"
  games: Game[];
  parentId?: string | null;   // parent folder ID for nested collections
}

export interface AppBackup {
  version: string;
  folders: Folder[];
}
