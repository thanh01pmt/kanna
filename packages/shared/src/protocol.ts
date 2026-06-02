import type {
  AppSettingsSnapshot,
  AppSettingsPatch,
  AgentProvider,
  ChatAttachment,
  ChatDiffSnapshot,
  ChatHistoryPage,
  ChatSnapshot,
  DiffCommitMode,
  KeybindingsSnapshot,
  LlmProviderSnapshot,
  LocalProjectsSnapshot,
  ModelOptions,
  SidebarData,
  StandaloneTranscriptAttachmentMode,
  StandaloneTranscriptExportResult,
  UpdateSnapshot,
  EditorPreset,
  WorkflowRunProjection,
  FlowEdgeProvenance,
  WorkflowMarketplaceMetadata,
} from "./types"

export type { EditorPreset }

export interface EditorOpenSettings {
  preset: EditorPreset
  commandTemplate: string
}

export interface LocalHttpServerInfo {
  title: string
  address: string
  port: number
  status: number
  ownerPath?: string
  processName?: string
  sameProject?: boolean
}

export interface ProjectQuickAction {
  id: string
  label: string
  command: string
}

export interface ProjectFileEntry {
  path: string
  type: "file" | "directory"
}

export type SubscriptionTopic =
  | { type: "sidebar" }
  | { type: "local-projects" }
  | { type: "update" }
  | { type: "keybindings" }
  | { type: "app-settings" }
  | { type: "chat"; chatId: string; recentLimit?: number }
  | { type: "project-git"; projectId: string }
  | { type: "project-workflow"; projectId: string }
  | { type: "terminal"; terminalId: string }

export interface TerminalSnapshot {
  terminalId: string
  title: string
  cwd: string
  shell: string
  cols: number
  rows: number
  scrollback: number
  serializedState: string
  status: "running" | "exited"
  exitCode: number | null
  signal?: number
}

export type TerminalEvent =
  | { type: "terminal.output"; terminalId: string; data: string }
  | { type: "terminal.exit"; terminalId: string; exitCode: number; signal?: number }

export type ClientCommand =
  | { type: "project.open"; localPath: string }
  | { type: "project.listFiles"; projectId: string }
  | { type: "project.listMarkdownFiles"; projectId: string }
  | { type: "project.readFile"; projectId: string; relativePath: string }
  | { type: "project.writeFile"; projectId: string; relativePath: string; content: string }
  | { type: "project.readMarkdownFile"; projectId: string; relativePath: string }
  | { type: "project.writeMarkdownFile"; projectId: string; relativePath: string; content: string }
  | { type: "project.create"; localPath: string; title: string }
  | { type: "project.rename"; projectId: string; title: string }
  | { type: "project.remove"; projectId?: string; localPath?: string; deleteHistory?: boolean }
  | { type: "sidebar.reorderProjectGroups"; projectIds: string[] }
  | { type: "project.readDiffPatch"; projectId: string; path: string }
  | { type: "system.ping" }
  | { type: "browser.listLocalHttpServers"; projectId?: string }
  | { type: "browser.killLocalHttpServer"; port: number }
  | { type: "project.readQuickActions"; projectId: string }
  | { type: "project.writeQuickActions"; projectId: string; quickActions: ProjectQuickAction[] }
  | { type: "workflow.listDefinitions"; projectId?: string }
  | { type: "workflow.deleteDefinition"; projectId: string; workflowDefinitionId: string }
  | { type: "project.registerWorkflow"; projectId: string; workflowDefinitionId: string; versionId?: string; isDefaultEntrypoint?: boolean }
  | { type: "project.unregisterWorkflow"; projectId: string; workflowDefinitionId: string }
  | { type: "project.updateWorkflowRegistration"; projectId: string; workflowDefinitionId: string; patch: { versionId?: string; enabled?: boolean; isDefaultEntrypoint?: boolean; settings?: Record<string, unknown> } }
  | { type: "project.registerPack"; projectId: string; packId: string }
  | { type: "project.addFlowEdge"; projectId: string; sourceWorkflowDefinitionId: string; targetWorkflowDefinitionId: string; provenance: FlowEdgeProvenance }
  | { type: "project.removeFlowEdge"; projectId: string; sourceWorkflowDefinitionId: string; targetWorkflowDefinitionId: string; provenance: FlowEdgeProvenance }
  | { type: "project.approveFlowEdge"; projectId: string; edgeId: string }
  | { type: "project.rejectFlowEdge"; projectId: string; edgeId: string }
  | { type: "workflow.startRun"; projectId: string; workflowDefinitionId: string; chatId?: string; input?: Record<string, unknown> }
  | { type: "workflow.publishManifest"; projectId?: string; manifest: Record<string, unknown>; sourceMarkdown?: string }
  | { type: "workflow.updateArtifactImpact"; projectId: string; runId?: string; sourceArtifactId: string; impactedArtifactId?: string; status: "needs_review" | "reviewed_ok" | "needs_repair" | "repaired" | "not_impacted" | "maybe_impacted"; reason?: string }
  | { type: "workflow.markArtifact"; projectId: string; artifactId: string; action: "invalidate" | "accept_source_of_truth"; reason?: string }
  | { type: "workflow.recoverLock"; projectId: string; lockId: string }
  | { type: "workflow.inspectResumePlan"; projectId: string; runId: string }
  | { type: "workflow.resumeRun"; projectId: string; runId: string }
  | { type: "workflow.restartRun"; projectId: string; runId: string }
  | { type: "workflow.archiveRun"; projectId: string; runId: string }
  | { type: "workflow.spawnParallelJob"; projectId: string; parentRunId: string; workflowDefinitionId: string }
  | { type: "workflow.mergeParallelJob"; projectId: string; jobId: string }
  | { type: "workflow.discardParallelJob"; projectId: string; jobId: string }
  | { type: "workflow.shareWorkflow"; projectId: string; definitionId: string }
  | { type: "workflow.importWorkflowById"; projectId: string; shareId: string }
  | { type: "workflow.publishGlobalRequest"; projectId: string; definitionId: string; metadata: WorkflowMarketplaceMetadata }
  | { type: "workflow.approveGlobalPublish"; projectId: string; definitionId: string }
  | { type: "workflow.rejectGlobalPublish"; projectId: string; definitionId: string }
  | { type: "update.check"; force?: boolean }
  | { type: "update.install" }
  | { type: "settings.readKeybindings" }
  | { type: "settings.writeKeybindings"; bindings: KeybindingsSnapshot["bindings"] }
  | { type: "settings.readAppSettings" }
  | { type: "settings.readPiProviderCatalog" }
  | { type: "settings.writeAppSettings"; analyticsEnabled: boolean }
  | { type: "settings.writeAppSettingsPatch"; patch: AppSettingsPatch }
  | { type: "settings.readLlmProvider" }
  | { type: "skills.search"; query: string; limit?: number }
  | { type: "skills.install"; source: string; skillId: string }
  | { type: "skills.uninstall"; skillId: string }
  | { type: "skills.listInstalled" }
  | {
      type: "settings.writeLlmProvider"
      provider: LlmProviderSnapshot["provider"]
      apiKey: string
      model: string
      baseUrl: string
    }
  | {
      type: "settings.validateLlmProvider"
      provider: LlmProviderSnapshot["provider"]
      apiKey: string
      model: string
      baseUrl: string
    }
  | {
      type: "system.openExternal"
      localPath: string
      action: "open_finder" | "open_terminal" | "open_editor" | "open_preview" | "open_default"
      line?: number
      column?: number
      editor?: EditorOpenSettings
    }
  | { type: "chat.create"; projectId: string }
  | { type: "chat.fork"; chatId: string }
  | { type: "chat.rename"; chatId: string; title: string }
  | { type: "chat.archive"; chatId: string }
  | { type: "chat.unarchive"; chatId: string }
  | { type: "chat.delete"; chatId: string }
  | { type: "chat.setDraftProtection"; chatIds: string[] }
  | { type: "chat.markRead"; chatId: string }
  | {
      type: "chat.send"
      chatId?: string
      projectId?: string
      clientTraceId?: string
      provider?: AgentProvider
      content: string
      attachments?: ChatAttachment[]
      model?: string
      modelOptions?: ModelOptions
      effort?: string
      planMode?: boolean
    }
  | { type: "chat.refreshDiffs"; chatId: string }
  | { type: "chat.initGit"; chatId: string }
  | { type: "chat.getGitHubPublishInfo"; chatId: string }
  | { type: "chat.checkGitHubRepoAvailability"; chatId: string; owner: string; name: string }
  | {
      type: "chat.publishToGitHub"
      chatId: string
      owner: string
      name: string
      visibility: "public" | "private"
      description?: string
    }
  | { type: "chat.listBranches"; chatId: string }
  | {
      type: "chat.previewMergeBranch"
      chatId: string
      branch:
      | { kind: "local"; name: string }
      | { kind: "remote"; name: string; remoteRef: string }
      | {
          kind: "pull_request"
          name: string
          prNumber: number
          headRefName: string
          headRepoCloneUrl?: string
          isCrossRepository?: boolean
          remoteRef?: string
        }
    }
  | {
      type: "chat.mergeBranch"
      chatId: string
      branch:
      | { kind: "local"; name: string }
      | { kind: "remote"; name: string; remoteRef: string }
      | {
          kind: "pull_request"
          name: string
          prNumber: number
          headRefName: string
          headRepoCloneUrl?: string
          isCrossRepository?: boolean
          remoteRef?: string
        }
    }
  | { type: "chat.syncBranch"; chatId: string; action: "fetch" | "pull" | "push" | "publish" }
  | {
      type: "chat.checkoutBranch"
      chatId: string
      branch:
      | { kind: "local"; name: string }
      | { kind: "remote"; name: string; remoteRef: string }
      | {
          kind: "pull_request"
          name: string
          prNumber: number
          headRefName: string
          headRepoCloneUrl?: string
          isCrossRepository?: boolean
          remoteRef?: string
        }
      bringChanges?: boolean
    }
  | { type: "chat.createBranch"; chatId: string; name: string; baseBranchName?: string }
  | { type: "chat.generateCommitMessage"; chatId: string; paths: string[] }
  | { type: "chat.commitDiffs"; chatId: string; paths: string[]; summary: string; description?: string; mode: DiffCommitMode }
  | { type: "chat.discardDiffFile"; chatId: string; path: string }
  | { type: "chat.ignoreDiffFile"; chatId: string; path: string }
  | { type: "chat.cancel"; chatId: string }
  | { type: "chat.stopDraining"; chatId: string }
  | {
      type: "chat.exportStandalone"
      chatId: string
      theme: "light" | "dark"
      attachmentMode: StandaloneTranscriptAttachmentMode
    }
  | { type: "chat.loadHistory"; chatId: string; beforeCursor: string; limit: number }
  | { type: "chat.respondTool"; chatId: string; toolUseId: string; result: unknown }
  | {
      type: "message.enqueue"
      chatId: string
      content: string
      attachments?: ChatAttachment[]
      provider?: AgentProvider
      model?: string
      modelOptions?: ModelOptions
      planMode?: boolean
    }
  | {
      type: "message.steer"
      chatId: string
      queuedMessageId: string
    }
  | {
      type: "message.dequeue"
      chatId: string
      queuedMessageId: string
    }
  | { type: "terminal.create"; projectId: string; terminalId: string; cols: number; rows: number; scrollback: number }
  | { type: "terminal.input"; terminalId: string; data: string }
  | { type: "terminal.resize"; terminalId: string; cols: number; rows: number }
  | { type: "terminal.close"; terminalId: string }

export type OpenExternalAction = Extract<ClientCommand, { type: "system.openExternal" }>["action"]

export type ClientEnvelope =
  | { v: 1; type: "subscribe"; id: string; topic: SubscriptionTopic }
  | { v: 1; type: "unsubscribe"; id: string }
  | { v: 1; type: "command"; id: string; command: ClientCommand }

export type ServerSnapshot =
  | { type: "sidebar"; data: SidebarData }
  | { type: "local-projects"; data: LocalProjectsSnapshot }
  | { type: "update"; data: UpdateSnapshot }
  | { type: "keybindings"; data: KeybindingsSnapshot }
  | { type: "app-settings"; data: AppSettingsSnapshot }
  | { type: "llm-provider"; data: LlmProviderSnapshot }
  | { type: "chat"; data: ChatSnapshot | null }
  | { type: "project-git"; data: ChatDiffSnapshot | null }
  | { type: "project-workflow"; data: WorkflowRunProjection | null }
  | { type: "terminal"; data: TerminalSnapshot | null }

export type ServerEnvelope =
  | { v: 1; type: "snapshot"; id: string; snapshot: ServerSnapshot }
  | { v: 1; type: "event"; id: string; event: TerminalEvent }
  | { v: 1; type: "ack"; id: string; result?: unknown | ChatHistoryPage | StandaloneTranscriptExportResult }
  | { v: 1; type: "error"; id?: string; message: string }

export function isClientEnvelope(value: unknown): value is ClientEnvelope {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ClientEnvelope>
  return candidate.v === 1 && typeof candidate.type === "string"
}
