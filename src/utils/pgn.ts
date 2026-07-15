import { Game, Folder, MovePly } from '../types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Get current date as "YYYY-MM-DD"
 */
export function getCurrentDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Recursively format move list with comments and variations for PGN
 */
export function formatMovesPGN(
  plies: MovePly[],
  round: number,
  activeColor: 'w' | 'b'
): string {
  const parts: string[] = [];
  let currentRound = round;
  let currentColor = activeColor;

  for (let i = 0; i < plies.length; i++) {
    const ply = plies[i];
    const isWhite = currentColor === 'w';

    let prefix = '';
    if (isWhite) {
      prefix = `${currentRound}. `;
    } else {
      // Black move needs round... if it's the first move, or after comment/variation
      if (i === 0 || ply.comment || (i > 0 && (plies[i - 1].comment || (plies[i - 1].variations && plies[i - 1].variations!.length > 0)))) {
        prefix = `${currentRound}... `;
      }
    }

    let commentStr = '';
    if (ply.comment) {
      commentStr = ` {${ply.comment}}`;
    }

    parts.push(`${prefix}${ply.move}${commentStr}`);

    // If there are variations, export them recursively inside parentheses
    if (ply.variations && ply.variations.length > 0) {
      for (const variation of ply.variations) {
        const varRound = currentRound;
        const varColor = isWhite ? 'w' : 'b';
        const formattedVar = formatMovesPGN(variation, varRound, varColor);
        parts.push(`(${formattedVar})`);
      }
    }

    // Toggle turn color
    if (currentColor === 'w') {
      currentColor = 'b';
    } else {
      currentColor = 'w';
      currentRound++;
    }
  }

  return parts.join(' ');
}

/**
 * Export a single Game to standard PGN string
 */
export function exportToPGN(game: Game, folderName: string): string {
  const headers = [
    `[Event "${game.event || 'Casual Game'}"]`,
    `[Site "${game.site || 'Chess Notation Manager'}"]`,
    `[Date "${game.date}"]`,
    `[Round "?"]`,
    `[White "${game.whitePlayer || 'White'}"]`,
    `[Black "${game.blackPlayer || 'Black'}"]`,
    `[Result "${game.result || '*'}"]`,
    `[Annotator "Chess Notation Manager"]`
  ];

  if (game.initialFen) {
    headers.push(`[SetUp "1"]`);
    headers.push(`[FEN "${game.initialFen}"]`);
  }
  if (game.themes) {
    headers.push(`[Themes "${game.themes}"]`);
  }

  let startingFullmove = 1;
  let startingActiveColor: 'w' | 'b' = 'w';
  if (game.initialFen) {
    const fenParts = game.initialFen.trim().split(/\s+/);
    if (fenParts.length >= 6) {
      startingFullmove = parseInt(fenParts[5], 10) || 1;
    }
    if (fenParts.length >= 2) {
      startingActiveColor = fenParts[1] === 'b' ? 'b' : 'w';
    }
  } else if (game.startingColor === 'black') {
    startingActiveColor = 'b';
  }

  const movesPGN = formatMovesPGN(game.moves, startingFullmove, startingActiveColor);

  let resultPGN = headers.join('\n') + '\n\n' + movesPGN;
  
  if (game.notes) {
    resultPGN += `\n\n{Notes: ${game.notes}}`;
  }
  
  return resultPGN;
}

/**
 * Recursively parse PGN moves string into standard MovePly hierarchy
 */
export function parsePgnMoves(movesText: string): MovePly[] {
  const plies: MovePly[] = [];
  let i = 0;
  let currentPly: MovePly | null = null;

  while (i < movesText.length) {
    const char = movesText[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Parse comments: { ... }
    if (char === '{') {
      let comment = '';
      i++; // skip '{'
      let braceCount = 1;
      while (i < movesText.length && braceCount > 0) {
        if (movesText[i] === '{') braceCount++;
        if (movesText[i] === '}') braceCount--;
        if (braceCount > 0) {
          comment += movesText[i];
        }
        i++;
      }
      comment = comment.trim();
      if (comment) {
        if (comment.startsWith('Notes:')) {
          // Skip general notes inside moves, they are captured separately
        } else if (currentPly) {
          currentPly.comment = currentPly.comment 
            ? `${currentPly.comment} ${comment}` 
            : comment;
        }
      }
      continue;
    }

    // Parse variations: ( ... )
    if (char === '(') {
      let depth = 1;
      let variationText = '';
      i++; // skip '('
      while (i < movesText.length && depth > 0) {
        if (movesText[i] === '(') depth++;
        if (movesText[i] === ')') depth--;
        if (depth > 0) {
          variationText += movesText[i];
        }
        i++;
      }
      // Recursively parse variation
      const variationPlies = parsePgnMoves(variationText);
      if (variationPlies.length > 0 && currentPly) {
        if (!currentPly.variations) {
          currentPly.variations = [];
        }
        currentPly.variations.push(variationPlies);
      }
      continue;
    }

    // Skip Numeric Annotation Glyphs (NAGs) like $1, $2
    if (char === '$') {
      i++;
      while (i < movesText.length && /\d/.test(movesText[i])) {
        i++;
      }
      continue;
    }

    // Parse token
    let token = '';
    while (
      i < movesText.length &&
      !/\s/.test(movesText[i]) &&
      movesText[i] !== '{' &&
      movesText[i] !== '}' &&
      movesText[i] !== '(' &&
      movesText[i] !== ')'
    ) {
      token += movesText[i];
      i++;
    }

    if (!token) continue;

    // Skip move numbers (e.g. "1.", "1...")
    if (/^\d+\.+$/.test(token)) {
      continue;
    }

    // Skip results (e.g. "1-0", "0-1", "1/2-1/2", "*")
    if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) {
      continue;
    }

    // Otherwise, it's a move token!
    currentPly = {
      id: generateId(),
      move: token
    };
    plies.push(currentPly);
  }

  return plies;
}

/**
 * Parse a PGN string into a list of partial Games with headers and full recursive variations
 */
export function parsePGN(pgnText: string): Partial<Game>[] {
  const games: Partial<Game>[] = [];
  
  // Split into individual games (separated by double blank lines or headers)
  const gameBlocks = pgnText.split(/\n(?=\[Event )/g);

  for (const block of gameBlocks) {
    if (!block.trim()) continue;

    // Parse headers
    const headers: Record<string, string> = {};
    const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
    let match;
    let lastHeaderIndex = 0;

    while ((match = headerRegex.exec(block)) !== null) {
      headers[match[1]] = match[2];
      lastHeaderIndex = headerRegex.lastIndex;
    }

    // Get the moves text (everything after the headers)
    const movesText = block.substring(lastHeaderIndex).trim();
    if (!movesText && Object.keys(headers).length === 0) continue;

    // Parse moves hierarchically
    const moves = parsePgnMoves(movesText);

    // Determine default game title
    let title = 'Imported Game';
    if (headers['White'] && headers['Black']) {
      title = `${headers['White']} vs ${headers['Black']}`;
    } else if (headers['White']) {
      title = `${headers['White']}'s Game`;
    } else if (headers['Event']) {
      title = headers['Event'];
    }

    let startingColor: 'white' | 'black' = 'white';
    let initialFen: string | undefined = undefined;
    if (headers['SetUp'] === '1' && (headers['FEN'] || headers['Fen'])) {
      initialFen = headers['FEN'] || headers['Fen'];
      const fenParts = initialFen.split(/\s+/);
      if (fenParts[1] === 'b') {
        startingColor = 'black';
      } else if (fenParts[1] === 'w') {
        startingColor = 'white';
      }
    }

    // Capture overall general notes if they are present as {Notes: ...} at the end of the text
    let generalNotes = '';
    const notesRegex = /\{Notes:\s*([^\}]+)\}/i;
    const notesMatch = movesText.match(notesRegex);
    if (notesMatch) {
      generalNotes = notesMatch[1].trim();
    }

    const statusVal = headers['PuzzleStatus']?.toLowerCase();
    const puzzleStatus = (statusVal === 'solved' || statusVal === 'failed' || statusVal === 'unsolved')
      ? statusVal as 'solved' | 'failed' | 'unsolved'
      : (initialFen ? 'unsolved' : undefined);

    games.push({
      id: generateId(),
      title,
      date: headers['Date'] || getCurrentDateString(),
      startingColor,
      moves,
      notes: generalNotes || undefined,
      event: headers['Event'],
      site: headers['Site'],
      whitePlayer: headers['White'],
      blackPlayer: headers['Black'],
      result: headers['Result'] || '*',
      initialFen,
      themes: headers['Themes'],
      puzzleStatus
    });
  }

  return games;
}
