import React from 'react';
import { FilePlus, Trash2, FileCode, FileText } from 'lucide-react';
import type { Theme, SessionState, FileChangeType } from '../types';

// Get color based on context usage percentage
export const getContextColor = (usage: number, theme: Theme): string => {
  if (usage >= 80) return theme.colors.error;
  if (usage >= 60) return theme.colors.warning;
  return theme.colors.success;
};

// Get color based on session state
export const getStatusColor = (state: SessionState, theme: Theme): string => {
  switch (state) {
    case 'busy': return theme.colors.error;
    case 'waiting_input': return theme.colors.warning;
    default: return theme.colors.success;
  }
};

// Get file icon based on change type
export const getFileIcon = (type: FileChangeType | undefined, theme: Theme): JSX.Element => {
  switch (type) {
    case 'added': return <FilePlus className="w-3.5 h-3.5" style={{ color: theme.colors.success }} />;
    case 'deleted': return <Trash2 className="w-3.5 h-3.5" style={{ color: theme.colors.error }} />;
    case 'modified': return <FileCode className="w-3.5 h-3.5" style={{ color: theme.colors.warning }} />;
    default: return <FileText className="w-3.5 h-3.5" style={{ color: theme.colors.textDim }} />;
  }
};
