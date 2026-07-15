import React, { useState } from 'react';
import { X, Upload, FileText, Info, HelpCircle } from 'lucide-react';
import { parsePGN } from '../utils/pgn';
import { Folder, Game } from '../types';

interface ImportModalProps {
  folders: Folder[];
  activeFolderId: string | null;
  onClose: () => void;
  onImportSuccess: (importedGames: Partial<Game>[], folderOption: 'current' | 'new', folderName?: string) => void;
  darkMode: boolean;
}

export default function ImportModal({
  folders,
  activeFolderId,
  onClose,
  onImportSuccess,
  darkMode
}: ImportModalProps) {
  const [pgnInput, setPgnInput] = useState('');
  const [importOption, setImportOption] = useState<'new' | 'current'>(
    activeFolderId ? 'current' : 'new'
  );
  const [customFolderName, setCustomFolderName] = useState('Imported Games');
  const [errorMsg, setErrorMsg] = useState('');

  const activeFolder = folders.find(f => f.id === activeFolderId);

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanInput = pgnInput.trim();
    if (!cleanInput) {
      setErrorMsg('Please enter or paste a valid PGN string first.');
      return;
    }

    try {
      const parsed = parsePGN(cleanInput);
      if (parsed.length === 0) {
        setErrorMsg('No valid chess games or moves found in the pasted PGN.');
        return;
      }

      onImportSuccess(
        parsed,
        importOption,
        importOption === 'new' ? customFolderName.trim() : undefined
      );
    } catch (err: any) {
      setErrorMsg(`Failed to parse PGN: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="import-modal-container">
      <div className={`w-full max-w-lg rounded-xl shadow-xl overflow-hidden border p-5 ${
        darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-950'
      }`} id="import-modal-content">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800 mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-500" />
            Import PGN / Chess Games
          </h3>
          <button 
            onClick={onClose}
            className={`p-1 rounded hover:bg-stone-100 dark:hover:bg-zinc-800 ${
              darkMode ? 'text-zinc-500 hover:text-white' : 'text-stone-400 hover:text-stone-800'
            }`}
            id="btn-close-import-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleImportSubmit} className="flex flex-col gap-4">
          
          {/* Instructions */}
          <div className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
            darkMode ? 'bg-zinc-950/50 border-zinc-800/85 text-zinc-400' : 'bg-stone-50 border-stone-100 text-stone-600'
          }`} id="import-modal-info">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">How to Import:</p>
              Paste standard Portable Game Notation (PGN) or raw chess moves list (e.g., <code className="font-mono bg-stone-200/50 dark:bg-zinc-800 px-1 py-0.2 rounded text-[11px]">1. e4 e5 2. Nf3 Nc6</code>). The system supports multi-game PGN databases and parses meta-headers (White, Black, Date, Event, Result, comments) automatically.
            </div>
          </div>

          {/* Text Area */}
          <div className="flex flex-col gap-1">
            <label className={`text-xs font-bold ${darkMode ? 'text-zinc-400' : 'text-stone-600'}`}>
              Paste PGN Code or Raw Moves
            </label>
            <textarea
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              placeholder={`[Event "Casual Game"]\n[White "Carlsen"]\n[Black "Nakamura"]\n\n1. e4 e5 2. Nf3 Nc6 *`}
              className={`w-full h-44 p-3 text-xs font-mono rounded-lg border outline-none resize-none leading-relaxed ${
                darkMode
                  ? 'bg-zinc-950 border-zinc-800 focus:border-amber-500/50 text-white placeholder-zinc-700'
                  : 'bg-stone-50 border-stone-200 focus:border-stone-400 text-stone-900 placeholder-stone-400'
              }`}
              id="pgn-import-textarea"
            />
          </div>

          {/* Destination options */}
          <div className="flex flex-col gap-2">
            <label className={`text-xs font-bold ${darkMode ? 'text-zinc-400' : 'text-stone-600'}`}>
              Import Destination
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Option A: Current Folder */}
              <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                !activeFolderId ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                importOption === 'current'
                  ? 'border-amber-500 bg-amber-50/10'
                  : darkMode ? 'border-zinc-850 bg-zinc-950/20' : 'border-stone-200 bg-stone-50/40'
              }`} id="import-option-current">
                <input
                  type="radio"
                  name="importDest"
                  value="current"
                  disabled={!activeFolderId}
                  checked={importOption === 'current'}
                  onChange={() => setImportOption('current')}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="text-xs">
                  <p className="font-semibold">Current Selected Folder</p>
                  <p className={`text-[10px] truncate mt-0.5 ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                    {activeFolder ? `Import into "${activeFolder.name}"` : 'No selected folder'}
                  </p>
                </div>
              </label>

              {/* Option B: New Folder */}
              <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                importOption === 'new'
                  ? 'border-amber-500 bg-amber-50/10'
                  : darkMode ? 'border-zinc-850 bg-zinc-950/20' : 'border-stone-200 bg-stone-50/40'
              }`} id="import-option-new">
                <input
                  type="radio"
                  name="importDest"
                  value="new"
                  checked={importOption === 'new'}
                  onChange={() => setImportOption('new')}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="text-xs w-full">
                  <p className="font-semibold">Create New Folder</p>
                  <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                    Creates a dedicated folder
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Custom Folder Name (only if option is 'new') */}
          {importOption === 'new' && (
            <div className="flex flex-col gap-1 animate-fade-in" id="custom-folder-name-container">
              <label className={`text-xs font-bold ${darkMode ? 'text-zinc-400' : 'text-stone-600'}`}>
                New Folder Name
              </label>
              <input
                type="text"
                value={customFolderName}
                onChange={(e) => setCustomFolderName(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-md border outline-none ${
                  darkMode
                    ? 'bg-zinc-950 border-zinc-800 text-white focus:border-zinc-700'
                    : 'bg-white border-stone-250 text-stone-900 focus:border-stone-400'
                }`}
                placeholder="e.g. Imported Games"
                id="import-custom-folder-name"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400" id="import-error-msg">
              ⚠️ {errorMsg}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold rounded-md border transition-all ${
                darkMode
                  ? 'bg-zinc-950 border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200'
                  : 'bg-white border-stone-250 hover:bg-stone-100 text-stone-600'
              }`}
              id="btn-import-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-md transition-all shadow-sm flex items-center gap-1.5"
              id="btn-import-submit"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
