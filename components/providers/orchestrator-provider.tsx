/**
 * FlowMind — Orchestrator Global Provider
 *
 * Manages the open/close state of the AI orchestrator panel
 * and global keyboard shortcuts. Replaces EdgeAgentProvider for
 * the AI chat functionality.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface OrchestratorContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const OrchestratorContext = createContext<OrchestratorContextValue | null>(null);

export function useOrchestratorUI(): OrchestratorContextValue {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) {
    throw new Error("useOrchestratorUI 必须在 <OrchestratorProvider> 内使用");
  }
  return ctx;
}

export function OrchestratorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + A → toggle orchestrator
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      // ESC → close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <OrchestratorContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </OrchestratorContext.Provider>
  );
}
