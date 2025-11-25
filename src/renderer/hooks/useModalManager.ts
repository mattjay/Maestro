/**
 * Modal Manager Hook
 *
 * Manages a stack of modal states with priority-based ordering.
 * This hook provides a simplified API for opening and closing modals.
 */

import { useState, useCallback } from 'react';

/**
 * Represents the state of a modal in the stack
 */
export interface ModalState {
  id: string;
  priority: number;
  data?: any;
}

/**
 * API for managing modals
 */
export interface ModalManagerAPI {
  /**
   * Opens a modal and adds it to the stack
   * @param id - Unique identifier for the modal
   * @param priority - Priority value (higher = appears on top)
   * @param data - Optional data to associate with the modal
   */
  openModal: (id: string, priority: number, data?: any) => void;

  /**
   * Closes a specific modal by ID
   * @param id - The modal ID to close
   */
  closeModal: (id: string) => void;

  /**
   * Closes the topmost modal in the stack
   */
  closeTopModal: () => void;

  /**
   * Checks if a specific modal is currently open
   * @param id - The modal ID to check
   * @returns true if the modal is in the stack
   */
  isModalOpen: (id: string) => boolean;

  /**
   * Returns true if any modal is currently open
   */
  anyModalOpen: boolean;

  /**
   * Returns the topmost modal in the stack, or undefined if stack is empty
   */
  topModal: ModalState | undefined;
}

/**
 * Hook for managing a stack of modals with priority-based ordering
 *
 * @example
 * ```tsx
 * const { openModal, closeModal, isModalOpen, anyModalOpen } = useModalManager();
 *
 * // Open a modal
 * openModal('settings', 450, { tab: 'general' });
 *
 * // Check if open
 * if (isModalOpen('settings')) {
 *   console.log('Settings is open');
 * }
 *
 * // Close it
 * closeModal('settings');
 * ```
 */
export function useModalManager(): ModalManagerAPI {
  const [modalStack, setModalStack] = useState<ModalState[]>([]);

  /**
   * Opens a modal and adds it to the stack, sorted by priority
   */
  const openModal = useCallback((id: string, priority: number, data?: any) => {
    setModalStack((prevStack) => {
      // Remove existing modal with same ID if present
      const filtered = prevStack.filter((modal) => modal.id !== id);

      // Add new modal and sort by priority (ascending)
      const newStack = [...filtered, { id, priority, data }];
      newStack.sort((a, b) => a.priority - b.priority);

      return newStack;
    });
  }, []);

  /**
   * Closes a specific modal by ID
   */
  const closeModal = useCallback((id: string) => {
    setModalStack((prevStack) => prevStack.filter((modal) => modal.id !== id));
  }, []);

  /**
   * Closes the topmost modal (highest priority)
   */
  const closeTopModal = useCallback(() => {
    setModalStack((prevStack) => {
      if (prevStack.length === 0) return prevStack;

      // Remove the last item (highest priority)
      return prevStack.slice(0, -1);
    });
  }, []);

  /**
   * Checks if a specific modal is open
   */
  const isModalOpen = useCallback(
    (id: string) => {
      return modalStack.some((modal) => modal.id === id);
    },
    [modalStack]
  );

  return {
    openModal,
    closeModal,
    closeTopModal,
    isModalOpen,
    anyModalOpen: modalStack.length > 0,
    topModal: modalStack.length > 0 ? modalStack[modalStack.length - 1] : undefined,
  };
}
