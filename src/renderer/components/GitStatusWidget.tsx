import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Minus, FileEdit } from 'lucide-react';
import type { Theme } from '../types';
import { gitService } from '../services/git';

interface GitFileChange {
  path: string;
  status: string;
  additions?: boolean;
  deletions?: boolean;
  modified?: boolean;
}

interface GitStatusWidgetProps {
  cwd: string;
  isGitRepo: boolean;
  theme: Theme;
  onViewDiff: () => void;
}

export function GitStatusWidget({ cwd, isGitRepo, theme, onViewDiff }: GitStatusWidgetProps) {
  const [fileChanges, setFileChanges] = useState<GitFileChange[]>([]);
  const [additions, setAdditions] = useState(0);
  const [deletions, setDeletions] = useState(0);
  const [modified, setModified] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isGitRepo) {
      setFileChanges([]);
      setAdditions(0);
      setDeletions(0);
      setModified(0);
      return;
    }

    const loadGitStatus = async () => {
      setLoading(true);
      try {
        const status = await gitService.getStatus(cwd);

        // Parse porcelain format: XY PATH
        // X = index status, Y = working tree status
        // ' ' = unmodified, M = modified, A = added, D = deleted, R = renamed, C = copied
        // ? = untracked, ! = ignored
        const changes: GitFileChange[] = [];
        let adds = 0;
        let dels = 0;
        let mods = 0;

        status.files.forEach(file => {
          const statusCode = file.status.trim();
          const indexStatus = statusCode[0];
          const workingStatus = statusCode[1] || ' ';

          const change: GitFileChange = {
            path: file.path,
            status: statusCode,
            additions: false,
            deletions: false,
            modified: false
          };

          // Check for additions (new files)
          if (indexStatus === 'A' || indexStatus === '?' || workingStatus === 'A' || workingStatus === '?') {
            change.additions = true;
            adds++;
          }

          // Check for deletions
          if (indexStatus === 'D' || workingStatus === 'D') {
            change.deletions = true;
            dels++;
          }

          // Check for modifications
          if (indexStatus === 'M' || workingStatus === 'M' || indexStatus === 'R' || workingStatus === 'R') {
            change.modified = true;
            mods++;
          }

          changes.push(change);
        });

        setFileChanges(changes);
        setAdditions(adds);
        setDeletions(dels);
        setModified(mods);
      } catch (error) {
        console.error('Failed to load git status:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGitStatus();

    // Refresh every 5 seconds
    const interval = setInterval(loadGitStatus, 5000);
    return () => clearInterval(interval);
  }, [cwd, isGitRepo]);

  // Don't render if not a git repo or no changes
  if (!isGitRepo || fileChanges.length === 0) {
    return null;
  }

  const totalChanges = additions + deletions + modified;

  return (
    <div className="relative group">
      <button
        onClick={onViewDiff}
        className="flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors hover:bg-white/5"
        style={{ color: theme.colors.textMain }}
      >
        <GitBranch className="w-3 h-3" />

        {additions > 0 && (
          <span className="flex items-center gap-0.5 text-green-500">
            <Plus className="w-3 h-3" />
            {additions}
          </span>
        )}

        {deletions > 0 && (
          <span className="flex items-center gap-0.5 text-red-500">
            <Minus className="w-3 h-3" />
            {deletions}
          </span>
        )}

        {modified > 0 && (
          <span className="flex items-center gap-0.5 text-orange-500">
            <FileEdit className="w-3 h-3" />
            {modified}
          </span>
        )}
      </button>

      {/* Hover tooltip showing file list */}
      <div
        className="absolute top-full left-0 mt-2 w-80 rounded shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          backgroundColor: theme.colors.bgSidebar,
          borderColor: theme.colors.border,
          border: '1px solid'
        }}
      >
        <div
          className="text-[10px] uppercase font-bold p-3 border-b"
          style={{
            color: theme.colors.textDim,
            borderColor: theme.colors.border
          }}
        >
          Changed Files ({totalChanges})
        </div>
        <div className="max-h-64 overflow-y-auto">
          {fileChanges.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 text-xs border-b last:border-b-0 font-mono"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.textMain
              }}
            >
              <div className="flex items-center gap-1 shrink-0">
                {file.additions && (
                  <Plus className="w-3 h-3 text-green-500" />
                )}
                {file.deletions && (
                  <Minus className="w-3 h-3 text-red-500" />
                )}
                {file.modified && !file.additions && !file.deletions && (
                  <FileEdit className="w-3 h-3 text-orange-500" />
                )}
              </div>
              <span className="truncate" title={file.path}>{file.path}</span>
            </div>
          ))}
        </div>
        <div
          className="text-[10px] p-2 text-center border-t"
          style={{
            color: theme.colors.textDim,
            borderColor: theme.colors.border
          }}
        >
          Click to view full diff
        </div>
      </div>
    </div>
  );
}
