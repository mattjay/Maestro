/**
 * DirectorySelectionScreen.tsx
 *
 * Second screen of the onboarding wizard - allows users to select
 * a project directory with browse functionality and Git repo detection.
 *
 * Features:
 * - Directory path input field
 * - Browse button (native folder picker via window.maestro.dialog.selectFolder())
 * - Auto-detection of agent path using window.maestro.agents.get()
 * - Git repo indicator showing whether selected path is a Git repository
 * - Keyboard support (Tab between fields, Enter to proceed, Escape to go back)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Theme, AgentConfig } from '../../../types';
import { useWizard } from '../WizardContext';

interface DirectorySelectionScreenProps {
  theme: Theme;
}

/**
 * DirectorySelectionScreen - Project directory selection with Git detection
 */
export function DirectorySelectionScreen({ theme }: DirectorySelectionScreenProps): JSX.Element {
  const {
    state,
    setDirectoryPath,
    setIsGitRepo,
    setDetectedAgentPath,
    setDirectoryError,
    nextStep,
    previousStep,
    canProceedToNext,
  } = useWizard();

  // Local state
  const [isValidating, setIsValidating] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);

  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Detect agent path on mount using the selected agent configuration
   */
  useEffect(() => {
    let mounted = true;

    async function detectAgentPath() {
      if (!state.selectedAgent) {
        setIsDetecting(false);
        return;
      }

      try {
        const agentConfig: AgentConfig | null = await window.maestro.agents.get(state.selectedAgent);
        if (mounted && agentConfig?.path) {
          setDetectedAgentPath(agentConfig.path);
          // If no directory is currently selected, use the detected path
          if (!state.directoryPath) {
            setDirectoryPath(agentConfig.path);
            // Also validate this path
            validateDirectory(agentConfig.path);
          }
        }
      } catch (error) {
        console.error('Failed to detect agent path:', error);
      }

      if (mounted) {
        setIsDetecting(false);
      }
    }

    detectAgentPath();
    return () => { mounted = false; };
    // Intentionally not including validateDirectory - we only want this to run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedAgent, setDetectedAgentPath, setDirectoryPath]);

  /**
   * Validate directory and check Git repo status
   */
  const validateDirectory = useCallback(async (path: string) => {
    if (!path.trim()) {
      setDirectoryError(null);
      setIsGitRepo(false);
      return;
    }

    setIsValidating(true);
    setDirectoryError(null);

    try {
      // Check if path exists by attempting to read it
      // The git.isRepo check will fail if the directory doesn't exist
      const isRepo = await window.maestro.git.isRepo(path);
      setIsGitRepo(isRepo);
      setDirectoryError(null);
    } catch (error) {
      // If git check fails, the directory might not exist or is inaccessible
      console.error('Directory validation error:', error);
      setDirectoryError('Unable to access this directory. Please check the path exists.');
      setIsGitRepo(false);
    }

    setIsValidating(false);
  }, [setIsGitRepo, setDirectoryError]);

  /**
   * Focus input on mount (after detection completes)
   */
  useEffect(() => {
    if (!isDetecting && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isDetecting]);

  /**
   * Handle path input change with debounced validation
   */
  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    setDirectoryPath(newPath);

    // Debounce validation to avoid excessive API calls while typing
    if (newPath.trim()) {
      const timeoutId = setTimeout(() => {
        validateDirectory(newPath);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setDirectoryError(null);
      setIsGitRepo(false);
    }
  }, [setDirectoryPath, setDirectoryError, setIsGitRepo, validateDirectory]);

  /**
   * Handle browse button click - open native folder picker
   */
  const handleBrowse = useCallback(async () => {
    setIsBrowsing(true);

    try {
      const selectedPath = await window.maestro.dialog.selectFolder();
      if (selectedPath) {
        setDirectoryPath(selectedPath);
        await validateDirectory(selectedPath);
        // Focus the continue button after selection if valid
        setTimeout(() => {
          if (canProceedToNext()) {
            continueButtonRef.current?.focus();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Browse failed:', error);
      setDirectoryError('Failed to open folder picker');
    }

    setIsBrowsing(false);
  }, [setDirectoryPath, validateDirectory, canProceedToNext, setDirectoryError]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (canProceedToNext() && !isValidating) {
          nextStep();
        }
        break;

      case 'Escape':
        e.preventDefault();
        previousStep();
        break;
    }
  }, [canProceedToNext, isValidating, nextStep, previousStep]);

  /**
   * Handle continue button click
   */
  const handleContinue = useCallback(() => {
    if (canProceedToNext()) {
      nextStep();
    }
  }, [canProceedToNext, nextStep]);

  /**
   * Handle back button click
   */
  const handleBack = useCallback(() => {
    previousStep();
  }, [previousStep]);

  // Loading state while detecting agent path
  if (isDetecting) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full p-8"
        style={{ color: theme.colors.textMain }}
      >
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4"
          style={{ borderColor: theme.colors.accent, borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: theme.colors.textDim }}>
          Detecting project location...
        </p>
      </div>
    );
  }

  const isValid = canProceedToNext();
  const showContinue = state.directoryPath.trim() !== '';

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full p-8"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h3
          className="text-2xl font-semibold mb-2"
          style={{ color: theme.colors.textMain }}
        >
          Where Should We Work?
        </h3>
        <p
          className="text-sm"
          style={{ color: theme.colors.textDim }}
        >
          Choose the folder where your project lives (or will live).
          {state.agentName && (
            <span
              className="block mt-1"
              style={{ color: theme.colors.accent }}
            >
              Project: {state.agentName}
            </span>
          )}
        </p>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          {/* Directory path input with browse button */}
          <div className="mb-6">
            <label
              htmlFor="directory-path"
              className="block text-sm mb-2 font-medium"
              style={{ color: theme.colors.textMain }}
            >
              Project Directory
            </label>
            <div className="flex gap-3">
              <input
                ref={inputRef}
                id="directory-path"
                type="text"
                value={state.directoryPath}
                onChange={handlePathChange}
                placeholder="/path/to/your/project"
                className="flex-1 px-4 py-3 rounded-lg border text-base outline-none transition-all font-mono"
                style={{
                  backgroundColor: theme.colors.bgMain,
                  borderColor: state.directoryError
                    ? theme.colors.error
                    : document.activeElement === inputRef.current
                    ? theme.colors.accent
                    : theme.colors.border,
                  color: theme.colors.textMain,
                  boxShadow: document.activeElement === inputRef.current
                    ? `0 0 0 2px ${theme.colors.accent}40`
                    : 'none',
                }}
                aria-invalid={!!state.directoryError}
                aria-describedby={state.directoryError ? 'directory-error' : undefined}
              />
              <button
                ref={browseButtonRef}
                onClick={handleBrowse}
                disabled={isBrowsing}
                className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 outline-none"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentForeground,
                  opacity: isBrowsing ? 0.7 : 1,
                }}
              >
                {isBrowsing ? (
                  <>
                    <div
                      className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: theme.colors.accentForeground, borderTopColor: 'transparent' }}
                    />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span>Browse</span>
                  </>
                )}
              </button>
            </div>

            {/* Error message */}
            {state.directoryError && (
              <p
                id="directory-error"
                className="mt-2 text-sm flex items-center gap-2"
                style={{ color: theme.colors.error }}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {state.directoryError}
              </p>
            )}
          </div>

          {/* Git repo status indicator */}
          {state.directoryPath.trim() && !state.directoryError && !isValidating && (
            <div
              className="mb-6 p-4 rounded-lg border flex items-center gap-3"
              style={{
                backgroundColor: state.isGitRepo
                  ? `${theme.colors.success}10`
                  : theme.colors.bgSidebar,
                borderColor: state.isGitRepo
                  ? theme.colors.success
                  : theme.colors.border,
              }}
            >
              {state.isGitRepo ? (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: theme.colors.success }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="white"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p
                      className="font-medium"
                      style={{ color: theme.colors.textMain }}
                    >
                      Git Repository Detected
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: theme.colors.textDim }}
                    >
                      Version control features will be available for this project.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: theme.colors.border }}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke={theme.colors.textDim}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p
                      className="font-medium"
                      style={{ color: theme.colors.textMain }}
                    >
                      Regular Directory
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: theme.colors.textDim }}
                    >
                      Not a Git repository. You can initialize one later if needed.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Validating indicator */}
          {isValidating && (
            <div
              className="mb-6 p-4 rounded-lg border flex items-center gap-3"
              style={{
                backgroundColor: theme.colors.bgSidebar,
                borderColor: theme.colors.border,
              }}
            >
              <div
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: theme.colors.accent, borderTopColor: 'transparent' }}
              />
              <p
                className="text-sm"
                style={{ color: theme.colors.textDim }}
              >
                Validating directory...
              </p>
            </div>
          )}

          {/* Detected path hint */}
          {state.detectedAgentPath && state.detectedAgentPath !== state.directoryPath && (
            <p
              className="text-xs mb-4"
              style={{ color: theme.colors.textDim }}
            >
              Detected location:{' '}
              <button
                onClick={() => {
                  setDirectoryPath(state.detectedAgentPath!);
                  validateDirectory(state.detectedAgentPath!);
                }}
                className="underline hover:opacity-80 transition-opacity"
                style={{ color: theme.colors.accent }}
              >
                Use {state.detectedAgentPath}
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Footer with navigation buttons */}
      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={handleBack}
          className="px-6 py-3 rounded-lg font-medium transition-all outline-none flex items-center gap-2"
          style={{
            backgroundColor: theme.colors.bgSidebar,
            color: theme.colors.textMain,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        {showContinue && (
          <button
            ref={continueButtonRef}
            onClick={handleContinue}
            disabled={!isValid || isValidating}
            className="px-8 py-3 rounded-lg font-medium transition-all outline-none flex items-center gap-2"
            style={{
              backgroundColor: isValid && !isValidating ? theme.colors.accent : theme.colors.border,
              color: isValid && !isValidating ? theme.colors.accentForeground : theme.colors.textDim,
              cursor: isValid && !isValidating ? 'pointer' : 'not-allowed',
              opacity: isValid && !isValidating ? 1 : 0.6,
            }}
          >
            Continue
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="mt-4 flex justify-center gap-6">
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: theme.colors.textDim }}
        >
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ backgroundColor: theme.colors.border }}
          >
            Tab
          </kbd>
          Navigate
        </span>
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: theme.colors.textDim }}
        >
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ backgroundColor: theme.colors.border }}
          >
            Enter
          </kbd>
          Continue
        </span>
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: theme.colors.textDim }}
        >
          <kbd
            className="px-1.5 py-0.5 rounded text-xs"
            style={{ backgroundColor: theme.colors.border }}
          >
            Esc
          </kbd>
          Go back
        </span>
      </div>
    </div>
  );
}
