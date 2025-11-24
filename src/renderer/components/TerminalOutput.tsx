import React, { useRef, useEffect, useMemo } from 'react';
import { Activity, X } from 'lucide-react';
import type { Session, Theme, LogEntry } from '../types';
import Convert from 'ansi-to-html';
import DOMPurify from 'dompurify';

interface TerminalOutputProps {
  session: Session;
  theme: Theme;
  activeFocus: string;
  outputSearchOpen: boolean;
  outputSearchQuery: string;
  setOutputSearchOpen: (open: boolean) => void;
  setOutputSearchQuery: (query: string) => void;
  setActiveFocus: (focus: string) => void;
  setLightboxImage: (image: string | null) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  logsEndRef: React.RefObject<HTMLDivElement>;
}

export function TerminalOutput(props: TerminalOutputProps) {
  const {
    session, theme, activeFocus, outputSearchOpen, outputSearchQuery,
    setOutputSearchOpen, setOutputSearchQuery, setActiveFocus, setLightboxImage,
    inputRef, logsEndRef
  } = props;

  const terminalOutputRef = useRef<HTMLDivElement>(null);

  // Auto-focus on search input when opened
  useEffect(() => {
    if (outputSearchOpen) {
      terminalOutputRef.current?.querySelector('input')?.focus();
    }
  }, [outputSearchOpen]);

  // Create ANSI converter with theme-aware colors
  const ansiConverter = useMemo(() => {
    return new Convert({
      fg: theme.colors.textMain,
      bg: theme.colors.bgMain,
      newline: false,
      escapeXML: true,
      stream: false,
      colors: {
        0: theme.colors.textMain,   // black -> textMain
        1: theme.colors.error,       // red -> error
        2: theme.colors.success,     // green -> success
        3: theme.colors.warning,     // yellow -> warning
        4: theme.colors.accent,      // blue -> accent
        5: theme.colors.accentDim,   // magenta -> accentDim
        6: theme.colors.accent,      // cyan -> accent
        7: theme.colors.textDim,     // white -> textDim
      }
    });
  }, [theme]);

  // Filter out bash prompt lines and apply processing
  const processLogText = (text: string, isTerminal: boolean): string => {
    if (!isTerminal) return text;

    // Remove bash prompt lines (e.g., "bash-3.2$", "zsh%", "$", "#")
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip empty lines and common prompt patterns
      if (!trimmed) return false;
      if (/^(bash-\d+\.\d+\$|zsh[%#]|\$|#)\s*$/.test(trimmed)) return false;
      return true;
    });

    return filteredLines.join('\n');
  };

  const activeLogs: LogEntry[] = session.inputMode === 'ai' ? session.aiLogs : session.shellLogs;

  return (
    <div
      ref={terminalOutputRef}
      tabIndex={0}
      className="flex-1 overflow-y-auto p-6 space-y-4 transition-colors outline-none relative"
      style={{ backgroundColor: session.inputMode === 'ai' ? theme.colors.bgMain : theme.colors.bgActivity }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          inputRef.current?.focus();
          setActiveFocus('main');
        }
      }}
    >
      {/* Output Search */}
      {outputSearchOpen && (
        <div className="sticky top-0 z-10 pb-4">
          <input
            type="text"
            value={outputSearchQuery}
            onChange={(e) => setOutputSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setOutputSearchOpen(false);
                setOutputSearchQuery('');
                terminalOutputRef.current?.focus();
              }
            }}
            placeholder="Filter output... (Esc to close)"
            className="w-full px-3 py-2 rounded border bg-transparent outline-none text-sm"
            style={{ borderColor: theme.colors.accent, color: theme.colors.textMain, backgroundColor: theme.colors.bgSidebar }}
            autoFocus
          />
        </div>
      )}
      {activeLogs.filter(log => {
        if (!outputSearchQuery) return true;
        return log.text.toLowerCase().includes(outputSearchQuery.toLowerCase());
      }).map(log => {
        const isTerminal = session.inputMode === 'terminal';
        const processedText = processLogText(log.text, isTerminal && log.source !== 'user');

        // Skip rendering if text is empty after processing
        if (!processedText.trim() && log.source !== 'user') return null;

        // Convert ANSI codes to HTML for terminal output and sanitize
        const htmlContent = isTerminal && log.source !== 'user'
          ? DOMPurify.sanitize(ansiConverter.toHtml(processedText))
          : processedText;

        return (
          <div key={log.id} className={`flex gap-4 group ${log.source === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="w-12 shrink-0 text-[10px] opacity-40 pt-2 font-mono text-center">
              {new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </div>
            <div className={`flex-1 p-4 rounded-xl border ${log.source === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                 style={{
                   backgroundColor: log.source === 'user' ? theme.colors.bgActivity : 'transparent',
                   borderColor: theme.colors.border
                 }}>
              {log.images && log.images.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto">
                  {log.images.map((img, idx) => (
                    <img key={idx} src={img} className="h-20 rounded border cursor-zoom-in" onClick={() => setLightboxImage(img)} />
                  ))}
                </div>
              )}
              {isTerminal && log.source !== 'user' ? (
                <div
                  className="whitespace-pre-wrap text-sm font-mono overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                  style={{ color: theme.colors.textMain }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm">{processedText}</div>
              )}
            </div>
          </div>
        );
      })}
      {session.state === 'busy' && (
        <div className="flex items-center justify-center gap-2 text-xs opacity-50 animate-pulse py-4">
          <Activity className="w-4 h-4" />
          {session.inputMode === 'ai' ? 'Claude is thinking...' : 'Executing shell command...'}
        </div>
      )}
      <div ref={logsEndRef} />
    </div>
  );
}
