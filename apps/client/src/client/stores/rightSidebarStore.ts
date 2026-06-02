import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface ProjectRightSidebarVisibilityState {
  rightPanel: "hidden" | "launcher" | "git" | "browser" | "files" | "workflow" | "diagnostics"
  openTabs?: string[]
  activeTab?: string | null
}

export interface ProjectRightSidebarUiState {
  viewMode: "changes" | "history"
  workflowDensityMode: "compact" | "normal" | "expanded"
  collapsedPaths: Record<string, boolean>
  summary: string
  description: string
}

export interface ProjectBrowserPanelState {
  address: string
  history: string[]
  historyIndex: number
  zoom: number
}

interface RightSidebarState {
  size: number
  projects: Record<string, ProjectRightSidebarVisibilityState>
  projectUi: Record<string, ProjectRightSidebarUiState>
  projectBrowser: Record<string, ProjectBrowserPanelState>
  togglePanel: (projectId: string, panel: Exclude<ProjectRightSidebarVisibilityState["rightPanel"], "hidden">) => void
  hidePanel: (projectId: string) => void
  openSidebarTab: (projectId: string, tabId: string) => void
  closeSidebarTab: (projectId: string, tabId: string) => void
  setActiveSidebarTab: (projectId: string, tabId: string) => void
  setSize: (size: number) => void
  navigateBrowser: (projectId: string, address: string) => void
  goBrowserBack: (projectId: string) => void
  goBrowserForward: (projectId: string) => void
  setBrowserZoom: (projectId: string, zoom: number) => void
  reconcileCollapsedPaths: (projectId: string, paths: string[]) => void
  toggleCollapsedPath: (projectId: string, path: string) => void
  setViewMode: (projectId: string, viewMode: ProjectRightSidebarUiState["viewMode"]) => void
  setWorkflowDensityMode: (projectId: string, densityMode: ProjectRightSidebarUiState["workflowDensityMode"]) => void
  setCommitDraft: (projectId: string, draft: Pick<ProjectRightSidebarUiState, "summary" | "description">) => void
  clearCommitDraft: (projectId: string) => void
  clearProject: (projectId: string) => void
}

export const DEFAULT_RIGHT_SIDEBAR_SIZE = 420
export const RIGHT_SIDEBAR_MIN_WIDTH_PX = 370

function clampSize(size: number) {
  if (!Number.isFinite(size)) return DEFAULT_RIGHT_SIDEBAR_SIZE
  return Math.max(RIGHT_SIDEBAR_MIN_WIDTH_PX, size)
}

export const DEFAULT_RIGHT_SIDEBAR_VISIBILITY_STATE: ProjectRightSidebarVisibilityState = {
  rightPanel: "hidden",
  openTabs: ["tool:files"],
  activeTab: "tool:files",
}

function createDefaultProjectVisibilityState(): ProjectRightSidebarVisibilityState {
  return { ...DEFAULT_RIGHT_SIDEBAR_VISIBILITY_STATE }
}

function createDefaultProjectUiState(): ProjectRightSidebarUiState {
  return {
    viewMode: "history",
    workflowDensityMode: "normal",
    collapsedPaths: {},
    summary: "",
    description: "",
  }
}

function createDefaultProjectBrowserState(): ProjectBrowserPanelState {
  return {
    address: "",
    history: [],
    historyIndex: -1,
    zoom: 1,
  }
}

function normalizeBrowserAddress(address: string) {
  const trimmed = address.trim()
  if (!trimmed) return ""
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(2, Math.max(0.5, Math.round(zoom * 10) / 10))
}

function getProjectVisibilityState(
  projects: Record<string, ProjectRightSidebarVisibilityState>,
  projectId: string
): ProjectRightSidebarVisibilityState {
  const existing = projects[projectId]
  if (!existing) {
    return createDefaultProjectVisibilityState()
  }
  const openTabs = (existing.openTabs || ["tool:files"]).filter(t => t !== "launcher" && t !== "tool:launcher")
  const activeTab = existing.activeTab === "launcher" || existing.activeTab === "tool:launcher" ? "tool:files" : existing.activeTab
  return {
    ...createDefaultProjectVisibilityState(),
    ...existing,
    openTabs,
    activeTab,
  }
}

function getProjectBrowserState(
  projectBrowser: Record<string, ProjectBrowserPanelState>,
  projectId: string
): ProjectBrowserPanelState {
  return projectBrowser[projectId] ?? createDefaultProjectBrowserState()
}

export function migrateRightSidebarStore(persistedState: unknown) {
  if (!persistedState || typeof persistedState !== "object") {
    return { size: DEFAULT_RIGHT_SIDEBAR_SIZE, projects: {}, projectUi: {}, projectBrowser: {} }
  }

  const state = persistedState as {
    size?: number
    projects?: Record<string, Partial<{ isVisible: boolean, rightPanel: ProjectRightSidebarVisibilityState["rightPanel"], size: number, openTabs: string[], activeTab: string | null }>>
    projectUi?: Record<string, ProjectRightSidebarUiState>
    projectBrowser?: Record<string, Partial<ProjectBrowserPanelState>>
  }
  const projects = Object.fromEntries(
    Object.entries(state.projects ?? {}).map(([projectId, layout]) => {
      const openTabs = (layout.openTabs ?? ["tool:files"]).filter(t => t !== "launcher" && t !== "tool:launcher")
      const activeTab = layout.activeTab === "launcher" || layout.activeTab === "tool:launcher" ? "tool:files" : layout.activeTab ?? "tool:files"
      return [
        projectId,
        {
          rightPanel: layout.rightPanel ?? (layout.isVisible ? "git" : "hidden"),
          openTabs,
          activeTab,
        },
      ]
    })
  )

  const projectBrowser = Object.fromEntries(
    Object.entries(state.projectBrowser ?? {}).map(([projectId, browserState]) => {
      const address = normalizeBrowserAddress(browserState.address ?? "")
      const history = (browserState.history ?? []).map(normalizeBrowserAddress).filter(Boolean)
      const historyIndex = Math.min(history.length - 1, Math.max(-1, browserState.historyIndex ?? (history.length - 1)))
      return [
        projectId,
        {
          address,
          history,
          historyIndex,
          zoom: clampZoom(browserState.zoom ?? 1),
        },
      ]
    })
  )

  return { size: DEFAULT_RIGHT_SIDEBAR_SIZE, projects, projectUi: state.projectUi ?? {}, projectBrowser }
}

export const useRightSidebarStore = create<RightSidebarState>()(
  persist(
    (set) => ({
      size: DEFAULT_RIGHT_SIDEBAR_SIZE,
      projects: {},
      projectUi: {},
      projectBrowser: {},
      togglePanel: (projectId, panel) =>
        set((state) => {
          const visState = getProjectVisibilityState(state.projects, projectId)
          const tabId = `tool:${panel}`
          
          if (visState.rightPanel === panel) {
            return {
              projects: {
                ...state.projects,
                [projectId]: {
                  ...visState,
                  rightPanel: "hidden",
                },
              },
            }
          } else {
            const openTabs = visState.openTabs || ["tool:files"]
            const nextTabs = openTabs.includes(tabId) ? openTabs : [...openTabs, tabId]
            return {
              projects: {
                ...state.projects,
                [projectId]: {
                  ...visState,
                  openTabs: nextTabs,
                  activeTab: tabId,
                  rightPanel: panel,
                },
              },
            }
          }
        }),
      hidePanel: (projectId) =>
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...getProjectVisibilityState(state.projects, projectId),
              rightPanel: "hidden",
            },
          },
        })),
      openSidebarTab: (projectId, tabId) =>
        set((state) => {
          if (tabId === "launcher" || tabId === "tool:launcher") {
            return {}
          }
          const visState = getProjectVisibilityState(state.projects, projectId)
          const openTabs = (visState.openTabs || ["tool:files"]).filter(t => t !== "launcher" && t !== "tool:launcher")
          const nextTabs = openTabs.includes(tabId) ? openTabs : [...openTabs, tabId]
          
          let rightPanel = visState.rightPanel
          if (tabId.startsWith("tool:")) {
            rightPanel = tabId.slice(5) as any
          } else {
            rightPanel = "files"
          }

          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...visState,
                openTabs: nextTabs,
                activeTab: tabId,
                rightPanel: rightPanel === "hidden" ? "files" : rightPanel,
              },
            },
          }
        }),
      closeSidebarTab: (projectId, tabId) =>
        set((state) => {
          const visState = getProjectVisibilityState(state.projects, projectId)
          const openTabs = visState.openTabs || ["tool:files"]
          const nextTabs = openTabs.filter((t) => t !== tabId)
          
          let activeTab = visState.activeTab
          if (activeTab === tabId) {
            const idx = openTabs.indexOf(tabId)
            activeTab = nextTabs[idx] || nextTabs[idx - 1] || null
          }

          let rightPanel = visState.rightPanel
          if (!activeTab) {
            rightPanel = "hidden"
          } else if (activeTab.startsWith("tool:")) {
            rightPanel = activeTab.slice(5) as any
          } else {
            rightPanel = "files"
          }

          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...visState,
                openTabs: nextTabs,
                activeTab,
                rightPanel,
              },
            },
          }
        }),
      setActiveSidebarTab: (projectId, tabId) =>
        set((state) => {
          const visState = getProjectVisibilityState(state.projects, projectId)
          
          let rightPanel = visState.rightPanel
          if (tabId.startsWith("tool:")) {
            rightPanel = tabId.slice(5) as any
          } else {
            rightPanel = "files"
          }

          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...visState,
                activeTab: tabId,
                rightPanel: rightPanel === "hidden" ? "files" : rightPanel,
              },
            },
          }
        }),
      setSize: (size) => set({ size: clampSize(size) }),
      navigateBrowser: (projectId, address) => set((state) => {
        const current = getProjectBrowserState(state.projectBrowser, projectId)
        const nextAddress = normalizeBrowserAddress(address)
        if (!nextAddress) {
          return {
            projectBrowser: {
              ...state.projectBrowser,
              [projectId]: {
                ...current,
                address: "",
              },
            },
          }
        }

        if (current.address === nextAddress) return state

        const previousHistory = current.history.slice(0, current.historyIndex + 1)
        const history = previousHistory[previousHistory.length - 1] === nextAddress
          ? previousHistory
          : [...previousHistory, nextAddress]

        return {
          projectBrowser: {
            ...state.projectBrowser,
            [projectId]: {
              ...current,
              address: nextAddress,
              history,
              historyIndex: history.length - 1,
            },
          },
        }
      }),
      goBrowserBack: (projectId) => set((state) => {
        const current = getProjectBrowserState(state.projectBrowser, projectId)
        const historyIndex = Math.max(0, current.historyIndex - 1)
        if (historyIndex === current.historyIndex || !current.history[historyIndex]) return state
        return {
          projectBrowser: {
            ...state.projectBrowser,
            [projectId]: {
              ...current,
              address: current.history[historyIndex],
              historyIndex,
            },
          },
        }
      }),
      goBrowserForward: (projectId) => set((state) => {
        const current = getProjectBrowserState(state.projectBrowser, projectId)
        const historyIndex = Math.min(current.history.length - 1, current.historyIndex + 1)
        if (historyIndex === current.historyIndex || !current.history[historyIndex]) return state
        return {
          projectBrowser: {
            ...state.projectBrowser,
            [projectId]: {
              ...current,
              address: current.history[historyIndex],
              historyIndex,
            },
          },
        }
      }),
      setBrowserZoom: (projectId, zoom) => set((state) => {
        const current = getProjectBrowserState(state.projectBrowser, projectId)
        const nextZoom = clampZoom(zoom)
        if (current.zoom === nextZoom) return state
        return {
          projectBrowser: {
            ...state.projectBrowser,
            [projectId]: {
              ...current,
              zoom: nextZoom,
            },
          },
        }
      }),
      reconcileCollapsedPaths: (projectId, paths) => set((state) => {
        const current = state.projectUi[projectId] ?? createDefaultProjectUiState()
        const collapsedPaths = { ...current.collapsedPaths }
        let changed = false

        for (const p of paths) {
          if (!(p in collapsedPaths)) {
            collapsedPaths[p] = true
            changed = true
          }
        }

        if (!changed) return state
        return {
          projectUi: {
            ...state.projectUi,
            [projectId]: {
              ...current,
              collapsedPaths,
            },
          },
        }
      }),
      toggleCollapsedPath: (projectId, path) => set((state) => {
        const current = state.projectUi[projectId] ?? createDefaultProjectUiState()
        return {
          projectUi: {
            ...state.projectUi,
            [projectId]: {
              ...current,
              collapsedPaths: {
                ...current.collapsedPaths,
                [path]: !current.collapsedPaths[path],
              },
            },
          },
        }
      }),
      setViewMode: (projectId, viewMode) => set((state) => {
        const current = state.projectUi[projectId] ?? createDefaultProjectUiState()
        if (current.viewMode === viewMode) return state
        return {
          projectUi: {
            ...state.projectUi,
            [projectId]: {
              ...current,
              viewMode,
            },
          },
        }
      }),
      setWorkflowDensityMode: (projectId, densityMode) => set((state) => {
        const current = state.projectUi[projectId] ?? createDefaultProjectUiState()
        if (current.workflowDensityMode === densityMode) return state
        return {
          projectUi: {
            ...state.projectUi,
            [projectId]: {
              ...current,
              workflowDensityMode: densityMode,
            },
          },
        }
      }),
      setCommitDraft: (projectId, draft) => set((state) => {
        const current = state.projectUi[projectId] ?? createDefaultProjectUiState()
        return {
          projectUi: {
            ...state.projectUi,
            [projectId]: {
              ...current,
              summary: draft.summary,
              description: draft.description,
            },
          },
        }
      }),
      clearCommitDraft: (projectId) => set((state) => {
        const current = state.projectUi[projectId] ?? createDefaultProjectUiState()
        return {
          projectUi: {
            ...state.projectUi,
            [projectId]: {
              ...current,
              summary: "",
              description: "",
            },
          },
        }
      }),
      clearProject: (projectId) => set((state) => {
        const projects = { ...state.projects }
        delete projects[projectId]
        const projectUi = { ...state.projectUi }
        delete projectUi[projectId]
        const projectBrowser = { ...state.projectBrowser }
        delete projectBrowser[projectId]
        return { projects, projectUi, projectBrowser }
      }),
    }),
    {
      name: "kanna-right-sidebar",
      migrate: migrateRightSidebarStore,
    }
  )
)
