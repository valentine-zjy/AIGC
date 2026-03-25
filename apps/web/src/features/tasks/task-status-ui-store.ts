"use client";

import { create } from "zustand";

import type {
  TaskRiskFilterIssueType,
  TaskRiskFilterLevel,
  TaskRiskFilterStatus,
  TaskRiskSortMode,
} from "@ai-rewrite/contracts";

export type TaskStatusUiStore = {
  selectedParagraphId: string | null;
  panelMode: "list" | "detail";
  filters: {
    riskLevel: TaskRiskFilterLevel;
    status: TaskRiskFilterStatus;
    issueType: TaskRiskFilterIssueType;
    sortBy: TaskRiskSortMode;
  };
  setSelectedParagraphId: (paragraphId: string | null) => void;
  setPanelMode: (panelMode: "list" | "detail") => void;
  setRiskLevelFilter: (riskLevel: TaskRiskFilterLevel) => void;
  setStatusFilter: (status: TaskRiskFilterStatus) => void;
  setIssueTypeFilter: (issueType: TaskRiskFilterIssueType) => void;
  setSortBy: (sortBy: TaskRiskSortMode) => void;
  resetFilters: () => void;
};

export function createTaskStatusUiStore(
  initialState?: Partial<
    Pick<TaskStatusUiStore, "selectedParagraphId" | "panelMode" | "filters">
  >,
) {
  return create<TaskStatusUiStore>((set) => ({
    selectedParagraphId: initialState?.selectedParagraphId ?? null,
    panelMode: initialState?.panelMode ?? "list",
    filters: {
      riskLevel: initialState?.filters?.riskLevel ?? "all",
      status: initialState?.filters?.status ?? "all",
      issueType: initialState?.filters?.issueType ?? "all",
      sortBy: initialState?.filters?.sortBy ?? "recommended",
    },
    setSelectedParagraphId: (selectedParagraphId) => set({ selectedParagraphId }),
    setPanelMode: (panelMode) => set({ panelMode }),
    setRiskLevelFilter: (riskLevel) =>
      set((state) => ({
        filters: {
          ...state.filters,
          riskLevel,
        },
      })),
    setStatusFilter: (status) =>
      set((state) => ({
        filters: {
          ...state.filters,
          status,
        },
      })),
    setIssueTypeFilter: (issueType) =>
      set((state) => ({
        filters: {
          ...state.filters,
          issueType,
        },
      })),
    setSortBy: (sortBy) =>
      set((state) => ({
        filters: {
          ...state.filters,
          sortBy,
        },
      })),
    resetFilters: () =>
      set(() => ({
        filters: {
          riskLevel: "all",
          status: "all",
          issueType: "all",
          sortBy: "recommended",
        },
      })),
  }));
}

export const useTaskStatusUiStore = createTaskStatusUiStore();