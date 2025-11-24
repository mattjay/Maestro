/**
 * Git operations service
 * Wraps IPC calls to main process for git operations
 */

export interface GitStatus {
  files: Array<{
    path: string;
    status: string;
  }>;
}

export interface GitDiff {
  diff: string;
}

export const gitService = {
  /**
   * Check if a directory is a git repository
   */
  async isRepo(cwd: string): Promise<boolean> {
    try {
      const result = await window.maestro.git.isRepo(cwd);
      return result;
    } catch (error) {
      console.error('Git isRepo error:', error);
      return false;
    }
  },

  /**
   * Get git status (porcelain format)
   */
  async getStatus(cwd: string): Promise<GitStatus> {
    try {
      const result = await window.maestro.git.status(cwd);

      // Parse porcelain format output
      const files: Array<{ path: string; status: string }> = [];

      if (result.stdout) {
        const lines = result.stdout.trim().split('\n').filter(line => line.length > 0);

        for (const line of lines) {
          // Porcelain format: XY PATH or XY PATH -> NEWPATH (for renames)
          const status = line.substring(0, 2);
          const path = line.substring(3).split(' -> ')[0]; // Handle renames

          files.push({ path, status });
        }
      }

      return { files };
    } catch (error) {
      console.error('Git status error:', error);
      return { files: [] };
    }
  },

  /**
   * Get git diff for specific files or all changes
   */
  async getDiff(cwd: string, files?: string[]): Promise<GitDiff> {
    try {
      // If no files specified, get full diff
      if (!files || files.length === 0) {
        const result = await window.maestro.git.diff(cwd);
        return { diff: result.stdout };
      }

      // Otherwise get diff for specific files
      const result = await window.maestro.git.diff(cwd, files);
      return result;
    } catch (error) {
      console.error('Git diff error:', error);
      return { diff: '' };
    }
  }
};
