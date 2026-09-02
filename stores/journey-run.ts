// stores/journey-run.ts
// 旅程运行态：跨页面持久（zustand persist → localStorage）。
// 旅程执行视图与各步骤页共享：startJourney 进入、advanceStep 推进、resetJourney 重置。
// 注：M2 起经由 /api/orchestrator/journeys 同步到 orchestrator_sessions，前端协议不变。
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface JourneyRunState {
  /** 当前运行的旅程 id */
  journeyId: string | null;
  /** 当前步骤序号（1-based；0 = 未开始） */
  currentStep: number;
  /** 已完成步骤 id 集合 */
  completedSteps: string[];
  startedAt: number | null;
}

interface JourneyRunStore extends JourneyRunState {
  start: (journeyId: string) => void;
  advance: (totalSteps: number, nextHref?: string) => void;
  markStepDone: (stepId: string) => void;
  reset: () => void;
}

export const useJourneyRun = create<JourneyRunStore>()(
  persist(
    (set, get) => ({
      journeyId: null,
      currentStep: 0,
      completedSteps: [],
      startedAt: null,
      start: (journeyId) =>
        set({ journeyId, currentStep: 1, completedSteps: [], startedAt: Date.now() }),
      advance: (totalSteps, nextHref) => {
        const { currentStep, journeyId } = get();
        if (!journeyId) return;
        set({ currentStep: Math.min(currentStep + 1, totalSteps) });
        if (nextHref) window.location.href = nextHref;
      },
      markStepDone: (stepId) =>
        set((s) => ({
          completedSteps: s.completedSteps.includes(stepId)
            ? s.completedSteps
            : [...s.completedSteps, stepId],
        })),
      reset: () => set({ journeyId: null, currentStep: 0, completedSteps: [], startedAt: null }),
    }),
    { name: "journey-run" },
  ),
);
