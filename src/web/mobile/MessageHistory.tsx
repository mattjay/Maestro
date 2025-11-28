/**
 * MessageHistory component for Maestro mobile web interface
 *
 * Displays the conversation history (AI logs and shell logs) for the active session.
 * Shows messages in a scrollable container with user/AI differentiation.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useThemeColors } from '../components/ThemeProvider';

/** Threshold for character-based truncation */
const CHAR_TRUNCATE_THRESHOLD = 500;
/** Threshold for line-based truncation */
const LINE_TRUNCATE_THRESHOLD = 8;

export interface LogEntry {
  id?: string;
  timestamp: number;
  text?: string;
  content?: string;
  source?: 'user' | 'stdout' | 'stderr' | 'system';
  type?: string;
}

export interface MessageHistoryProps {
  /** Log entries to display */
  logs: LogEntry[];
  /** Input mode to determine which logs to show */
  inputMode: 'ai' | 'terminal';
  /** Whether to auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Max height of the container */
  maxHeight?: string;
  /** Callback when user taps a message */
  onMessageTap?: (entry: LogEntry) => void;
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * MessageHistory component
 */
export function MessageHistory({
  logs,
  inputMode,
  autoScroll = true,
  maxHeight = '300px',
  onMessageTap,
}: MessageHistoryProps) {
  const colors = useThemeColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
  const prevLogsLengthRef = useRef(0);
  // Track which messages are expanded (by id or index)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  /**
   * Check if a message should be truncated
   */
  const shouldTruncate = useCallback((text: string): boolean => {
    if (text.length > CHAR_TRUNCATE_THRESHOLD) return true;
    const lineCount = text.split('\n').length;
    return lineCount > LINE_TRUNCATE_THRESHOLD;
  }, []);

  /**
   * Get truncated text for display
   */
  const getTruncatedText = useCallback((text: string): string => {
    const lines = text.split('\n');
    if (lines.length > LINE_TRUNCATE_THRESHOLD) {
      return lines.slice(0, LINE_TRUNCATE_THRESHOLD).join('\n');
    }
    if (text.length > CHAR_TRUNCATE_THRESHOLD) {
      return text.slice(0, CHAR_TRUNCATE_THRESHOLD);
    }
    return text;
  }, []);

  /**
   * Toggle expansion state for a message
   */
  const toggleExpanded = useCallback((messageKey: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageKey)) {
        next.delete(messageKey);
      } else {
        next.add(messageKey);
      }
      return next;
    });
  }, []);

  // Initial scroll - jump to bottom immediately without animation
  useEffect(() => {
    if (!hasInitiallyScrolled && logs.length > 0 && bottomRef.current) {
      // Use instant scroll for initial load
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
      setHasInitiallyScrolled(true);
      prevLogsLengthRef.current = logs.length;
    }
  }, [logs, hasInitiallyScrolled]);

  // Auto-scroll to bottom when new messages arrive (after initial load)
  useEffect(() => {
    if (hasInitiallyScrolled && autoScroll && bottomRef.current && logs.length > prevLogsLengthRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      prevLogsLengthRef.current = logs.length;
    }
  }, [logs, autoScroll, hasInitiallyScrolled]);

  // Reset scroll state when logs are cleared (e.g., session change)
  useEffect(() => {
    if (logs.length === 0) {
      setHasInitiallyScrolled(false);
      prevLogsLengthRef.current = 0;
    }
  }, [logs.length]);

  if (!logs || logs.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: colors.textDim,
          fontSize: '13px',
        }}
      >
        No messages yet
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: colors.bgMain,
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
      }}
    >
      {logs.map((entry, index) => {
        const text = entry.text || entry.content || '';
        const source = entry.source || (entry.type === 'user' ? 'user' : 'stdout');
        const isUser = source === 'user';
        const isError = source === 'stderr';
        const isSystem = source === 'system';
        const messageKey = entry.id || `${entry.timestamp}-${index}`;
        const isExpanded = expandedMessages.has(messageKey);
        const isTruncatable = shouldTruncate(text);
        const displayText = isExpanded || !isTruncatable ? text : getTruncatedText(text);

        return (
          <div
            key={messageKey}
            onClick={() => {
              if (isTruncatable) {
                toggleExpanded(messageKey);
              }
              onMessageTap?.(entry);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: isUser
                ? `${colors.accent}15`
                : isError
                  ? `${colors.error}10`
                  : isSystem
                    ? `${colors.textDim}10`
                    : colors.bgSidebar,
              border: `1px solid ${isUser
                ? `${colors.accent}30`
                : isError
                  ? `${colors.error}30`
                  : colors.border
              }`,
              cursor: isTruncatable ? 'pointer' : 'default',
              // Align user messages to the right
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
            }}
          >
            {/* Header: source and time */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '10px',
                color: colors.textDim,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: isUser
                    ? colors.accent
                    : isError
                      ? colors.error
                      : colors.textDim,
                }}
              >
                {isUser ? 'You' : isError ? 'Error' : isSystem ? 'System' : inputMode === 'ai' ? 'AI' : 'Output'}
              </span>
              <span style={{ opacity: 0.7 }}>{formatTime(entry.timestamp)}</span>
              {/* Show expand/collapse indicator for truncatable messages */}
              {isTruncatable && (
                <span style={{
                  marginLeft: 'auto',
                  color: colors.accent,
                  fontSize: '10px',
                }}>
                  {isExpanded ? '▼ collapse' : '▶ expand'}
                </span>
              )}
            </div>

            {/* Message content */}
            <div
              style={{
                fontSize: '13px',
                lineHeight: 1.5,
                color: isError ? colors.error : colors.textMain,
                fontFamily: inputMode === 'terminal' || isUser ? 'ui-monospace, monospace' : 'inherit',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}
            >
              {displayText}
              {/* Show truncation indicator at end of text */}
              {isTruncatable && !isExpanded && (
                <span style={{ color: colors.textDim, fontStyle: 'italic' }}>
                  {'\n'}... (tap to expand)
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageHistory;
