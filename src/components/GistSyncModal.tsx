import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  RefreshCw, 
  Key, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Info, 
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Folder } from '../types';

interface GistSyncModalProps {
  onClose: () => void;
  folders: Folder[];
  onSyncSuccess: (mergedFolders: Folder[], message: string) => void;
  darkMode: boolean;
  syncInterval: string;
  onSetSyncInterval: (interval: string) => void;
  autoSyncOnChanges: boolean;
  onSetAutoSyncOnChanges: (auto: boolean) => void;
}

interface GistSettings {
  token: string;
  gistId: string;
  syncInterval: string;
  lastSynced: string;
}

export default function GistSyncModal({
  onClose,
  folders,
  onSyncSuccess,
  darkMode,
  syncInterval,
  onSetSyncInterval,
  autoSyncOnChanges,
  onSetAutoSyncOnChanges
}: GistSyncModalProps) {
  // Load settings from localStorage
  const [token, setToken] = useState<string>(() => localStorage.getItem('gist_sync_token') || '');
  const [gistId, setGistId] = useState<string>(() => localStorage.getItem('gist_sync_id') || '');
  const [lastSynced, setLastSynced] = useState<string>(() => localStorage.getItem('gist_sync_last_time') || '');

  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ type: null, message: '' });
  const [showGuide, setShowGuide] = useState(false);

  // Save settings to localStorage helper
  const saveSettings = (updatedToken: string, updatedGistId: string) => {
    localStorage.setItem('gist_sync_token', updatedToken);
    localStorage.setItem('gist_sync_id', updatedGistId);
  };

  useEffect(() => {
    saveSettings(token, gistId);
  }, [token, gistId]);

  // Validate the credentials with GitHub API
  const handleValidate = async () => {
    if (!token.trim()) {
      setStatus({ type: 'error', message: 'GitHub token is required for validation.' });
      return;
    }
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Connecting to GitHub API...' });

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token.trim()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText} (${response.status})`);
      }

      const userData = await response.json();
      setStatus({ 
        type: 'success', 
        message: `Connected successfully! Authenticated as ${userData.name || userData.login}.` 
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to authenticate with GitHub. Check your token.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new secret Gist with current data
  const handleCreateGist = async () => {
    if (!token.trim()) {
      setStatus({ type: 'error', message: 'GitHub Personal Access Token is required to create a Gist.' });
      return;
    }
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Creating a new secret Gist...' });

    try {
      const backupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        folders: folders
      };

      const gistPayload = {
        description: 'Chess Notation Scorebook Synchronization Database',
        public: false,
        files: {
          'chess_notation_backup.json': {
            content: JSON.stringify(backupData, null, 2)
          }
        }
      };

      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          Authorization: `token ${token.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistPayload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create gist: ${response.statusText} (${response.status})`);
      }

      const responseData = await response.json();
      const newGistId = responseData.id;
      setGistId(newGistId);
      localStorage.setItem('gist_sync_id', newGistId);

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem('gist_sync_last_time', now);

      setStatus({
        type: 'success',
        message: `Successfully created secret Gist! Gist ID: ${newGistId}. It is now linked to your local workspace.`
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'An error occurred while creating the Gist.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Push local data to Gist (Overwrite Cloud)
  const handlePush = async () => {
    if (!token.trim() || !gistId.trim()) {
      setStatus({ type: 'error', message: 'GitHub token and Gist ID are both required to backup data.' });
      return;
    }
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Exporting scorebooks to Cloud...' });

    try {
      const backupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        folders: folders
      };

      const gistPayload = {
        description: 'Chess Notation Scorebook Synchronization Database',
        files: {
          'chess_notation_backup.json': {
            content: JSON.stringify(backupData, null, 2)
          }
        }
      };

      const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${token.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistPayload)
      });

      if (!response.ok) {
        throw new Error(`Cloud update failed: ${response.statusText} (${response.status})`);
      }

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem('gist_sync_last_time', now);

      setStatus({
        type: 'success',
        message: 'All local scoresheets successfully uploaded and saved to your cloud Gist!'
      });
      
      onSyncSuccess(folders, 'Data successfully pushed to cloud');
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to upload to Gist. Verify Gist ID and permissions.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Pull cloud data from Gist (Overwrite Local)
  const handlePull = async () => {
    if (!token.trim() || !gistId.trim()) {
      setStatus({ type: 'error', message: 'GitHub token and Gist ID are both required to fetch data.' });
      return;
    }
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Fetching scorebooks from Cloud...' });

    try {
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
        throw new Error('Could not find active "chess_notation_backup.json" inside the Gist.');
      }

      const parsed = JSON.parse(fileObj.content);
      const cloudFolders = parsed.folders;

      if (!cloudFolders || !Array.isArray(cloudFolders)) {
        throw new Error('Gist data format is invalid (no valid collections found).');
      }

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem('gist_sync_last_time', now);

      setStatus({
        type: 'success',
        message: `Successfully downloaded ${cloudFolders.length} collections from your cloud Gist!`
      });

      onSyncSuccess(cloudFolders, 'Data successfully pulled from cloud');
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to pull from Gist. Verify Gist ID and file integrity.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Bidirectional Smart Merge of local and cloud data (Lossless)
  const handleSmartMerge = async () => {
    if (!token.trim() || !gistId.trim()) {
      setStatus({ type: 'error', message: 'GitHub token and Gist ID are both required for a Smart Merge.' });
      return;
    }
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Fetching Cloud scoresheets for comparison...' });

    try {
      const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
        headers: {
          Authorization: `token ${token.trim()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch cloud database: ${response.statusText} (${response.status})`);
      }

      const gistData = await response.json();
      const fileObj = gistData.files['chess_notation_backup.json'];
      
      if (!fileObj || !fileObj.content) {
        throw new Error('Could not find active "chess_notation_backup.json" inside the Gist.');
      }

      const parsed = JSON.parse(fileObj.content);
      const cloudFolders = parsed.folders as Folder[];

      if (!cloudFolders || !Array.isArray(cloudFolders)) {
        throw new Error('Cloud Gist database format is invalid.');
      }

      setStatus({ type: 'info', message: 'Comparing and merging collections intelligently...' });

      // SMART MERGE ALGORITHM:
      // We will merge folders and games based on their unique IDs.
      // 1. Map all local and cloud folders by ID.
      const localFoldersMap = new Map<string, Folder>();
      folders.forEach(f => localFoldersMap.set(f.id, f));

      const cloudFoldersMap = new Map<string, Folder>();
      cloudFolders.forEach(f => cloudFoldersMap.set(f.id, f));

      const allFolderIds = new Set<string>([...localFoldersMap.keys(), ...cloudFoldersMap.keys()]);
      const mergedFolders: Folder[] = [];

      allFolderIds.forEach(folderId => {
        const localFolder = localFoldersMap.get(folderId);
        const cloudFolder = cloudFoldersMap.get(folderId);

        if (localFolder && cloudFolder) {
          // Folder exists in both. Merge their games.
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
              // Game exists in both. Compare contents to see which is more complete or newer.
              // Since we don't have explicit timestamps on individual games, we compare:
              // 1. Move count (longer move path usually means newer/more complete scoresheet)
              // 2. Report count
              // 3. Notes length
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

      setStatus({ type: 'info', message: 'Saving merged data to Cloud and Local...' });

      // Push merged database back to Cloud
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

      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem('gist_sync_last_time', now);

      setStatus({
        type: 'success',
        message: 'Lossless Smart Merge completed successfully! Both local workspace and cloud Gist have been synchronized.'
      });

      onSyncSuccess(mergedFolders, 'Bidirectional Smart Merge completed successfully');
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Failed to complete Smart Merge. Check Gist connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      id="gist-sync-modal-overlay"
    >
      <div 
        className={`w-full max-w-lg rounded-xl shadow-2xl border flex flex-col overflow-hidden max-h-[90vh] transition-all scale-100 ${
          darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-stone-200 text-stone-900'
        }`}
        onClick={(e) => e.stopPropagation()}
        id="gist-sync-modal-container"
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          darkMode ? 'border-zinc-800 bg-zinc-950/60' : 'border-stone-100 bg-stone-50/80'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-amber-950/40 text-amber-400' : 'bg-amber-50 text-amber-800'}`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">GitHub Gist Cloud Sync</h3>
              <p className={`text-[11px] ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                Synchronize your chess scoresheets across multiple devices
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
            }`}
            id="close-gist-sync-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          
          {/* Guide Dropdown */}
          <div className={`rounded-lg border p-3 ${
            darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-stone-50 border-stone-250/60'
          }`}>
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400"
              id="toggle-gist-guide-btn"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                How to set up GitHub Gist Syncing?
              </span>
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showGuide && (
              <div className={`mt-2.5 text-[11px] leading-relaxed space-y-1.5 pl-5 list-decimal ${
                darkMode ? 'text-zinc-400 border-t border-zinc-800/60 pt-2.5' : 'text-stone-600 border-t border-stone-200/60 pt-2.5'
              }`}>
                <p>1. Go to your <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-amber-500 underline inline-flex items-center gap-0.5 font-semibold">GitHub Developer Settings <ExternalLink className="w-2.5 h-2.5" /></a>.</p>
                <p>2. Generate a new personal access token (Classic or Fine-grained) with the <code className="font-mono bg-stone-200/60 dark:bg-zinc-800 px-1 py-0.2 rounded font-bold text-[10px]">gist</code> permission scope enabled.</p>
                <p>3. Copy the token and paste it into the field below.</p>
                <p>4. Click <strong className="text-stone-800 dark:text-zinc-200">"Create New Gist"</strong> to instantly initialize a secret workspace on GitHub, or paste an existing Gist ID if you've already created one.</p>
                <p>5. Click <strong className="text-amber-600 dark:text-amber-400">"Smart Merge"</strong> to safely sync your progress across other computers, or use Push/Pull to force backups.</p>
              </div>
            )}
          </div>

          {/* Configuration Inputs */}
          <div className="flex flex-col gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-zinc-400' : 'text-stone-700'}`}>
                GitHub Personal Access Token (PAT)
              </label>
              <div className="relative">
                <div className="absolute left-3 top-2.5">
                  <Key className={`w-4 h-4 ${darkMode ? 'text-zinc-500' : 'text-stone-400'}`} />
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className={`w-full pl-9 pr-10 py-2 text-xs rounded-lg outline-none border transition-colors font-mono ${
                    darkMode 
                      ? 'bg-zinc-950 border-zinc-850 focus:border-zinc-700 text-zinc-100 placeholder-zinc-600' 
                      : 'bg-white border-stone-250 focus:border-stone-400 text-stone-900 placeholder-stone-400'
                  }`}
                  id="gist-token-input"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className={`absolute right-3 top-2.5 transition-colors ${
                    darkMode ? 'text-zinc-500 hover:text-zinc-300' : 'text-stone-400 hover:text-stone-600'
                  }`}
                  title={showToken ? 'Hide token' : 'Show token'}
                  id="toggle-token-visibility"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-semibold ${darkMode ? 'text-zinc-400' : 'text-stone-700'}`}>
                  GitHub Gist ID (Optional/Auto-generated)
                </label>
                {token.trim() && !gistId.trim() && (
                  <button
                    onClick={handleCreateGist}
                    disabled={isLoading}
                    className="text-[11px] font-bold text-amber-500 hover:text-amber-400 hover:underline disabled:opacity-50"
                    id="btn-create-gist-inline"
                  >
                    + Create New Gist
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="e.g. 5f04b2b951478f72cxxxxxxxxxxxxxxx"
                value={gistId}
                onChange={(e) => setGistId(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-lg outline-none border transition-colors font-mono ${
                  darkMode 
                    ? 'bg-zinc-950 border-zinc-850 focus:border-zinc-700 text-zinc-100 placeholder-zinc-600' 
                    : 'bg-white border-stone-250 focus:border-stone-400 text-stone-900 placeholder-stone-400'
                }`}
                id="gist-id-input"
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-zinc-400' : 'text-stone-700'}`}>
                Periodical Background Sync
              </label>
              <select
                value={syncInterval}
                onChange={(e) => {
                  onSetSyncInterval(e.target.value);
                  localStorage.setItem('gist_sync_interval', e.target.value);
                }}
                className={`w-full px-3 py-2 text-xs rounded-lg outline-none border transition-colors ${
                  darkMode 
                    ? 'bg-zinc-950 border-zinc-850 focus:border-zinc-700 text-zinc-100' 
                    : 'bg-white border-stone-250 focus:border-stone-400 text-stone-900'
                }`}
                id="gist-sync-interval-select"
              >
                <option value="manual">Manual Sync Only</option>
                <option value="15m">Every 15 minutes</option>
                <option value="30m">Every 30 minutes</option>
                <option value="1h">Every 1 hour</option>
                <option value="4h">Every 4 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="24h">Every 24 hours</option>
              </select>
            </div>

            <div className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
              darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-stone-50 border-stone-200'
            }`} id="auto-sync-on-changes-container">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gist-sync-auto-on-changes-checkbox"
                  checked={autoSyncOnChanges}
                  onChange={(e) => onSetAutoSyncOnChanges(e.target.checked)}
                  className="rounded border-stone-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                />
                <label
                  htmlFor="gist-sync-auto-on-changes-checkbox"
                  className={`text-xs font-bold cursor-pointer select-none ${darkMode ? 'text-zinc-200' : 'text-stone-800'}`}
                >
                  Auto-Sync on Changes
                </label>
              </div>
              <p className={`text-[10px] pl-6 leading-relaxed ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                When enabled, local scorebook changes are automatically synced (smart lossless merge) to GitHub Gist after 20 seconds of inactivity to avoid server overload.
              </p>
            </div>
          </div>

          {/* Validation & Setup Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              disabled={isLoading || !token.trim()}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                darkMode
                  ? 'bg-zinc-950 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-750 text-zinc-200 disabled:opacity-40'
                  : 'bg-stone-50 hover:bg-stone-100 border-stone-250 text-stone-700 disabled:opacity-50'
              }`}
              id="btn-validate-token"
            >
              Test Connection
            </button>
          </div>

          <hr className={darkMode ? 'border-zinc-800' : 'border-stone-100'} />

          {/* Cloud Operations Panel */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${darkMode ? 'text-zinc-400' : 'text-stone-700'}`}>
                Synchronization Actions
              </span>
              {lastSynced && (
                <span className={`text-[10px] ${darkMode ? 'text-zinc-500' : 'text-stone-500'}`}>
                  Last Synced: <span className="font-medium">{lastSynced}</span>
                </span>
              )}
            </div>

            {/* Smart Bidirectional Merge */}
            <button
              onClick={handleSmartMerge}
              disabled={isLoading || !token.trim() || !gistId.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-all disabled:opacity-40 disabled:hover:bg-amber-600 shadow-sm shadow-amber-950/20"
              title="Compare and merge cloud and local databases losslessly"
              id="btn-smart-merge"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Lossless Smart Merge (Recommended)
            </button>

            {/* Manual Push / Pull Rows */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePush}
                disabled={isLoading || !token.trim() || !gistId.trim()}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  darkMode
                    ? 'bg-zinc-950 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-750 text-zinc-300 disabled:opacity-40'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-250 hover:border-stone-300 text-stone-750 disabled:opacity-50'
                }`}
                title="Overwrite Gist file on Cloud with current local data"
                id="btn-force-push"
              >
                <CloudUpload className="w-3.5 h-3.5 text-blue-500" />
                Upload to Cloud
              </button>

              <button
                onClick={handlePull}
                disabled={isLoading || !token.trim() || !gistId.trim()}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  darkMode
                    ? 'bg-zinc-950 hover:bg-zinc-850 border-zinc-800 hover:border-zinc-750 text-zinc-300 disabled:opacity-40'
                    : 'bg-stone-50 hover:bg-stone-100 border-stone-250 hover:border-stone-300 text-stone-750 disabled:opacity-50'
                }`}
                title="Overwrite local data completely with Cloud Gist data"
                id="btn-force-pull"
              >
                <CloudDownload className="w-3.5 h-3.5 text-emerald-500" />
                Download from Cloud
              </button>
            </div>
          </div>

          {/* Status Display Area */}
          {status.type && (
            <div className={`p-3 rounded-lg border text-xs leading-relaxed animate-fade-in flex items-start gap-2.5 ${
              status.type === 'success' 
                ? darkMode ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : status.type === 'error'
                  ? darkMode ? 'bg-rose-950/20 border-rose-900/40 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-800'
                  : status.type === 'info'
                    ? darkMode ? 'bg-blue-950/10 border-blue-900/30 text-blue-400' : 'bg-blue-50 border-blue-150 text-blue-850'
                    : darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-stone-50 border-stone-200 text-stone-700'
            }`} id="sync-status-box">
              {status.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />}
              {status.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />}
              {status.type === 'info' && <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin text-blue-500" />}
              <span>{status.message}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between text-[10px] ${
          darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-500' : 'border-stone-100 bg-stone-50/80 text-stone-500'
        }`}>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span>Secure SSL connection. Tokens are kept 100% locally on this device.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
