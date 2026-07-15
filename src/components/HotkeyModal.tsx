import React from 'react';
import { X, Keyboard, HelpCircle } from 'lucide-react';

interface HotkeyModalProps {
  onClose: () => void;
  darkMode: boolean;
}

export default function HotkeyModal({ onClose, darkMode }: HotkeyModalProps) {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modifier = isMac ? '⌘' : 'Ctrl';
  const altModifier = isMac ? 'Option' : 'Alt';

  const shortcuts = [
    {
      keys: [`${altModifier}`, 'N'],
      desc: 'New Game',
      detail: 'Instantly creates a new blank chess scoresheet inside the currently selected folder.'
    },
    {
      keys: [`${altModifier}`, 'Shift', 'N'],
      desc: 'New Folder',
      detail: 'Creates a new folder with the current date (YYYY-MM-DD).'
    },
    {
      keys: [`${modifier}`, 'S'],
      desc: 'Manual Save',
      detail: 'Triggers an explicit backup and manual save of all files to local storage (app also auto-saves on every move).'
    },
    {
      keys: [`${modifier}`, '←'],
      desc: 'Previous Game',
      detail: 'Switches to the previous game in the active folder without touching the mouse.'
    },
    {
      keys: [`${modifier}`, '→'],
      desc: 'Next Game',
      detail: 'Switches to the next game in the active folder without touching the mouse.'
    },
    {
      keys: [`${modifier}`, 'E'],
      desc: 'Export PGN',
      detail: 'Downloads the active chess game as a standard .pgn file with full headers, metadata, and annotations.'
    },
    {
      keys: [`${modifier}`, 'H'],
      desc: 'Hotkey Cheat Sheet',
      detail: 'Opens / closes this helpful shortcut dictionary overlay.'
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="hotkeys-modal-container">
      <div className={`w-full max-w-lg rounded-xl shadow-xl overflow-hidden border p-5 ${
        darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-950'
      }`} id="hotkeys-modal-content">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800 mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-amber-500" />
            Scoresheet Keyboard Shortcuts
          </h3>
          <button 
            onClick={onClose}
            className={`p-1 rounded hover:bg-stone-100 dark:hover:bg-zinc-800 ${
              darkMode ? 'text-zinc-500 hover:text-white' : 'text-stone-400 hover:text-stone-800'
            }`}
            id="btn-close-hotkeys-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="flex flex-col gap-3.5 max-h-[350px] overflow-y-auto pr-1" id="shortcuts-grid">
          {shortcuts.map((shortcut, index) => (
            <div 
              key={index}
              className={`flex items-start justify-between gap-4 p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-zinc-950/30' : 'hover:bg-stone-50/50'
              }`}
              id={`shortcut-item-${index}`}
            >
              <div className="flex-1">
                <p className="text-xs font-bold leading-tight">{shortcut.desc}</p>
                <p className={`text-[10px] mt-1 leading-normal ${
                  darkMode ? 'text-zinc-400' : 'text-stone-500'
                }`}>{shortcut.detail}</p>
              </div>

              {/* Key Badges */}
              <div className="flex items-center gap-1 shrink-0">
                {shortcut.keys.map((k, kidx) => (
                  <React.Fragment key={kidx}>
                    {kidx > 0 && <span className={`text-[10px] font-bold ${darkMode ? 'text-zinc-600' : 'text-stone-400'}`}>+</span>}
                    <kbd className={`px-2 py-1 text-[10px] font-bold font-mono rounded shadow border leading-none ${
                      darkMode
                        ? 'bg-zinc-800 border-zinc-700 text-white shadow-zinc-950'
                        : 'bg-stone-100 border-stone-250 text-stone-700 shadow-stone-200'
                    }`}>
                      {k}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className={`mt-5 p-3 rounded-lg text-[11px] leading-relaxed flex items-start gap-1.5 ${
          darkMode ? 'bg-zinc-950/40 text-zinc-500' : 'bg-stone-100 text-stone-500'
        }`} id="hotkeys-modal-footer-tip">
          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            These shortcuts are designed for rapid score-keeping during physical games. Keep your fingers on the home row to log moves without taking your eyes off the chessboard.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end mt-4 pt-3 border-t border-stone-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-md transition-all shadow-sm"
            id="btn-close-shortcuts-modal"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
