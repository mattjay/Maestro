import { parseDiff, File as DiffFile } from 'react-diff-view';

export interface ParsedFileDiff {
  oldPath: string;
  newPath: string;
  diffText: string;
  parsedDiff: DiffFile[];
}

/**
 * Parse git diff output and separate it by file
 * @param diffText - The raw git diff output
 * @returns Array of parsed file diffs
 */
export function parseGitDiff(diffText: string): ParsedFileDiff[] {
  if (!diffText || diffText.trim() === '') {
    return [];
  }

  // Split by "diff --git" to get individual file diffs
  const fileSections = diffText.split(/(?=diff --git)/g).filter(section => section.trim());

  return fileSections.map(section => {
    // Extract file paths from the diff header
    // Format: "diff --git a/path/to/file.ts b/path/to/file.ts"
    const pathMatch = section.match(/diff --git a\/(.*?) b\/(.*)/);
    const oldPath = pathMatch?.[1] || 'unknown';
    const newPath = pathMatch?.[2] || 'unknown';

    try {
      // Use react-diff-view's parseDiff to parse the diff section
      const parsedDiff = parseDiff(section);

      return {
        oldPath,
        newPath,
        diffText: section,
        parsedDiff
      };
    } catch (error) {
      console.error('Failed to parse diff section:', error);
      // Return a fallback structure if parsing fails
      return {
        oldPath,
        newPath,
        diffText: section,
        parsedDiff: []
      };
    }
  });
}

/**
 * Get a display name for a file path (just the filename)
 * @param path - Full file path
 * @returns Just the filename
 */
export function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * Get statistics for a parsed diff (additions, deletions)
 * @param parsedDiff - Parsed diff from react-diff-view
 * @returns Object with additions and deletions count
 */
export function getDiffStats(parsedDiff: DiffFile[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  parsedDiff.forEach(file => {
    file.hunks.forEach(hunk => {
      hunk.changes.forEach(change => {
        if (change.type === 'insert') additions++;
        if (change.type === 'delete') deletions++;
      });
    });
  });

  return { additions, deletions };
}
