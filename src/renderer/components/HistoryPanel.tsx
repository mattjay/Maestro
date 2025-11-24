import React from 'react';
import type { Session, Theme } from '../types';

interface HistoryPanelProps {
  session: Session;
  theme: Theme;
}

export function HistoryPanel({ session, theme }: HistoryPanelProps) {
  return (
    <div className="space-y-4">
      {session.workLog.length === 0 ? (
        <div className="text-center py-8 text-xs opacity-50">No semantic logs yet.</div>
      ) : (
        session.workLog.map(item => (
          <div key={item.id} className="relative pl-4 border-l pb-4 last:pb-0" style={{ borderColor: theme.colors.border }}>
            <div
              className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full border"
              style={{ backgroundColor: theme.colors.bgSidebar, borderColor: theme.colors.textDim }}
            />
            <div className="text-xs font-bold" style={{ color: theme.colors.textMain }}>
              {item.title}
            </div>
            <div className="text-xs mt-1 leading-relaxed opacity-70">
              {item.description}
            </div>
            <div className="text-[10px] mt-2 opacity-50">
              {new Date(item.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
