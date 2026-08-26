"use client";

import { useOrchestratorUI } from "@/components/providers/orchestrator-provider";
import { Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Global floating button to open the AI orchestrator panel.
 * Fixed bottom-right corner with pulse animation.
 */
export function FloatingAIButton() {
  const { isOpen, toggle } = useOrchestratorUI();

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggle}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors",
          isOpen
            ? "bg-destructive hover:bg-destructive/90"
            : "bg-primary hover:brightness-105",
        )}
        aria-label={isOpen ? "关闭 AI 助手" : "打开 AI 助手"}
      >
        <span className="relative text-white">
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Bot className="h-6 w-6" />
          )}
        </span>

        {/* Pulse ring when closed */}
        {!isOpen && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-20" />
        )}
      </motion.button>
    </AnimatePresence>
  );
}
