import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  BookText,
  Command,
  Code,
  ExternalLink,
  GitBranch,
  Info,
  Loader2,
  Menu,
  Monitor,
  Moon,
  MessageSquareQuote,
  Search,
  Settings2,
  Workflow,
  Sun,
  DownloadCloud,
  LogOut,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Plus,
  Settings,
  ArrowUpCircle,
  Upload,
  FileText,
  FilePenLine,
  Sparkles,
  Eye,
  EyeOff,
  Package,
  ArrowRight,
  Bot,
  Cpu,
} from "lucide-react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useNavigate, useOutletContext, useParams } from "react-router-dom"
import { getKeybindingsFilePathDisplay, SDK_CLIENT_APP } from "@kanna/shared/branding"
import { ANALYTICS_STATIC_EVENT_NAMES, ANALYTICS_STATIC_PROPERTY_NAMES } from "@kanna/shared/analytics"
import {
  DEFAULT_KEYBINDINGS,
  DEFAULT_OPENAI_SDK_MODEL,
  DEFAULT_OPENROUTER_SDK_MODEL,
  PROVIDERS,
  type AgentCliDetectionSnapshot,
  type AgentProvider,
  type CustomAgentConfig,
  type CustomAgentConnectionTestResult,
  type CustomAgentEnvVar,
  type InstalledSkillSummary,
  type KeybindingAction,
  type LlmProviderKind,
  type ProviderCatalogEntry,
  type InstalledSkillsSnapshot,
  type ProjectMcpConfig,
  type ProjectMcpServerConfig,
  type SkillInstallResult,
  type SkillSearchResult,
  type SkillSearchSnapshot,
  type SkillUninstallResult,
  type UpdateSnapshot,
  type WorkflowDefinitionSummary,
} from "@kanna/shared/types"
import { markdownComponents } from "../components/messages/shared"
import { ChatPreferenceControls } from "../components/chat-ui/ChatPreferenceControls"
import { EDITOR_OPTIONS, EditorIcon } from "../components/editor-icons"
import { Button, buttonVariants } from "../components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Textarea } from "../components/ui/textarea"
import { SettingsHeaderButton } from "../components/ui/settings-header-button"
import type { EditorPreset } from "@kanna/shared/protocol"
import { SegmentedControl } from "../components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import { useTheme, type ThemePreference } from "../hooks/useTheme"
import { KEYBINDING_ACTION_LABELS, formatKeybindingInput, getResolvedKeybindings, parseKeybindingInput } from "../lib/keybindings"
import { playChatNotificationSound } from "../lib/chatSounds"
import { cn } from "../lib/utils"
import {
  DEFAULT_TERMINAL_MIN_COLUMN_WIDTH,
  DEFAULT_TERMINAL_SCROLLBACK,
  MAX_TERMINAL_MIN_COLUMN_WIDTH,
  MAX_TERMINAL_SCROLLBACK,
  MIN_TERMINAL_MIN_COLUMN_WIDTH,
  MIN_TERMINAL_SCROLLBACK,
  getDefaultEditorCommandTemplate,
  useTerminalPreferencesStore,
} from "../stores/terminalPreferencesStore"
import { useChatPreferencesStore } from "../stores/chatPreferencesStore"
import { CHAT_SOUND_OPTIONS, useChatSoundPreferencesStore, type ChatSoundId, type ChatSoundPreference } from "../stores/chatSoundPreferencesStore"
import type { KannaState } from "./useKannaState"

const sidebarItems = [
  {
    id: "general",
    label: "General",
    icon: Settings2,
    subtitle: "Manage appearance, editor behavior, and embedded terminal defaults.",
  },
  {
    id: "skills",
    label: "Skills",
    icon: BookText,
    subtitle: "Manage globally installed agent skills from the active skill lock file.",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Bot,
    subtitle: "Manage default agent selection, default tools, and local/remote CLI configurations.",
  },
  {
    id: "llm",
    label: "LLM",
    icon: Cpu,
    subtitle: "Configure fallback LLM credentials and custom providers for Kanna.",
  },
  {
    id: "workflow",
    label: "Workflow",
    icon: Workflow,
    subtitle: "Inspect the workflow runtime, event-store model, and artifact tracking surfaces.",
  },
  {
    id: "mcp",
    label: "MCP",
    icon: GitBranch,
    subtitle: "Inspect the local MCP server config and workflow tools exposed to MCP clients.",
  },
  {
    id: "keybindings",
    label: "Keybindings",
    icon: Command,
    subtitle: "Edit global app shortcuts stored in the active keybindings file.",
  },
  // always last
  {
    id: "changelog",
    label: "Changelog",
    icon: BookText,
    subtitle: "Release notes pulled from the public GitHub releases feed.",
  },
] as const
type SidebarItem = (typeof sidebarItems)[number]
type SidebarPageId = SidebarItem["id"]

export function resolveSettingsSectionId(sectionId: string | undefined): SidebarPageId | null {
  if (!sectionId) return null
  return sidebarItems.some((item) => item.id === sectionId) ? (sectionId as SidebarPageId) : null
}

const themeOptions = [
  { value: "light" as ThemePreference, label: "Light", icon: Sun },
  { value: "dark" as ThemePreference, label: "Dark", icon: Moon },
  { value: "system" as ThemePreference, label: "System", icon: Monitor },
]

const chatSoundPreferenceOptions: { value: ChatSoundPreference; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "unfocused", label: "When Unfocused" },
  { value: "always", label: "Always" },
]

const analyticsOptions = [
  { value: "disabled" as const, label: "Off" },
  { value: "enabled" as const, label: "On" },
]

const QUICK_RESPONSE_PROVIDER_OPTIONS: Array<{ value: LlmProviderKind; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
]

const GITHUB_RELEASES_URL = "https://api.github.com/repos/jakemor/kanna/releases"
const CHANGELOG_CACHE_TTL_MS = 5 * 60 * 1000

type GithubRelease = {
  id: number
  name: string | null
  tag_name: string
  html_url: string
  published_at: string | null
  body: string | null
  prerelease: boolean
  draft: boolean
}

type ChangelogStatus = "idle" | "loading" | "success" | "error"

type ChangelogCache = {
  expiresAt: number
  releases: GithubRelease[]
}

type FetchReleases = (input: string, init?: RequestInit) => Promise<Response>

let changelogCache: ChangelogCache | null = null
const KEYBINDING_ACTIONS = Object.keys(KEYBINDING_ACTION_LABELS) as KeybindingAction[]

export function getKeybindingsSubtitle(filePathDisplay: string) {
  return `Edit global app shortcuts stored in ${filePathDisplay}.`
}

export function shouldPreviewChatSoundChange(
  previousValue: string,
  nextValue: string
) {
  return previousValue !== nextValue
}

export function resetSettingsPageChangelogCache() {
  changelogCache = null
}

export async function fetchGithubReleases(fetchImpl: FetchReleases = fetch): Promise<GithubRelease[]> {
  const response = await fetchImpl(GITHUB_RELEASES_URL, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub releases request failed with status ${response.status}`)
  }

  const payload = await response.json() as GithubRelease[]
  return payload.filter((release) => !release.draft)
}

export function getCachedChangelog() {
  if (!changelogCache) return null
  if (Date.now() >= changelogCache.expiresAt) {
    changelogCache = null
    return null
  }
  return changelogCache.releases
}

export function setCachedChangelog(releases: GithubRelease[]) {
  changelogCache = {
    releases,
    expiresAt: Date.now() + CHANGELOG_CACHE_TTL_MS,
  }
}

export async function loadChangelog(options?: { force?: boolean; fetchImpl?: FetchReleases }) {
  const cached = options?.force ? null : getCachedChangelog()
  if (cached) {
    return cached
  }

  const releases = await fetchGithubReleases(options?.fetchImpl)
  setCachedChangelog(releases)
  return releases
}

export function formatPublishedDate(value: string | null) {
  if (!value) return "Unpublished"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Unknown date"

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

export function ChangelogSection({
  status,
  releases,
  error,
  onRetry,
  updateSnapshot,
  currentVersion,
  onInstallUpdate,
  onCheckForUpdates,
}: {
  status: ChangelogStatus
  releases: GithubRelease[]
  error: string | null
  onRetry: () => void
  updateSnapshot: UpdateSnapshot | null
  currentVersion: string
  onInstallUpdate: () => void
  onCheckForUpdates: () => void
}) {
  const latestVersion = updateSnapshot?.latestVersion ?? releases[0]?.tag_name ?? "Unknown"
  const currentVersionLabel = updateSnapshot?.currentVersion ?? currentVersion
  const isChecking = updateSnapshot?.status === "checking"
  const isUpdating = updateSnapshot?.status === "updating" || updateSnapshot?.status === "restart_pending"
  const canInstallUpdate = updateSnapshot?.updateAvailable === true
  const normalizedLatestVersion = latestVersion.replace(/^v/i, "")
  const normalizedCurrentVersion = currentVersionLabel.replace(/^v/i, "")

  return (
    <div className="space-y-4">
      {status === "loading" || status === "idle" ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-border bg-card/40 px-6 py-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading release notes…</span>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Could not load changelog</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {error ?? "Unable to load changelog."}
              </div>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {status === "success" && releases.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/30 px-6 py-8">
          <div className="text-sm font-medium text-foreground">No releases yet</div>
          <div className="mt-2 text-sm text-muted-foreground">
            GitHub did not return any published releases for this repository.
          </div>
        </div>
      ) : null}

      {!canInstallUpdate && status === "success" ? (
        <div className="flex justify-end">
          <SettingsHeaderButton
            variant="outline"
            onClick={onCheckForUpdates}
            disabled={isChecking || isUpdating}
          >
            {isChecking ? "Checking…" : "Check for updates"}
          </SettingsHeaderButton>
        </div>
      ) : null}

      {status === "success" && releases.length > 0 ? (
        releases.map((release) => {
          const normalizedTag = release.tag_name.replace(/^v/i, "")
          const isLatestRelease = normalizedTag === normalizedLatestVersion
          const isCurrentRelease = normalizedTag === normalizedCurrentVersion

          return (
            <article
              key={release.id}
              className={cn(
                "rounded-xl border bg-card/30 pl-6 pr-4 py-4",
                isLatestRelease ? "border-border bg-muted" : "border-border"
              )}
            >

            <div className="flex flex-row items-center min-w-0 flex-1 gap-3 ">
              <div className="flex flex-row items-center min-w-0 flex-1 gap-2 ">
                <div className="text-lg font-semibold tracking-[-0.2px] text-foreground">
                  {release.name?.trim() || release.tag_name}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{formatPublishedDate(release.published_at)}</span>
                  {release.prerelease ? (
                    <span className="rounded-full border border-border px-2.5 py-1 uppercase tracking-wide">
                      Prerelease
                    </span>
                  ) : null}
                  
                </div>
              </div>


              <div className="flex flex-row items-center justify-end min-w-0 flex-1 gap-2 ">
                {/* <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  
                  <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-foreground/80">
                    {release.tag_name}
                  </span>
                </div> */}

             
            
                  <a
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View release on GitHub"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-sm" }),
                    "h-8 w-8 shrink-0 rounded-md hover:!bg-transparent hover:border-border/0"
                  )}
                >
                  <GitHubIcon className="h-4 w-4" />
                </a>

                  {isCurrentRelease ? (
                      
                  <span
                    className={cn(
                      "bg-transparent border border-border text-secondary-foreground",
                      'h-9 rounded-full px-3 text-sm',
                      "h-auto gap-1.5 px-3 py-1.5"
                    )}
                  >
                    Current
                  </span>
                  ) : null}
                  
                
                  { isLatestRelease && canInstallUpdate  ? (
                  <SettingsHeaderButton
                    variant="default"
                    className=""
                    onClick={onInstallUpdate}
                    disabled={isUpdating}
                  >
                    <div className="flex flex-row items-center justify-center gap-2">
                    <DownloadCloud className="size-4"/>
                    {isUpdating ? "Updating…" : "Update"}
                    </div>
                  </SettingsHeaderButton>
                ) : null}
              </div>
            
             
            </div>


            {release.body?.trim() ? (
              <div className="prose prose-sm mt-5 max-w-none text-foreground dark:prose-invert">
                <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {release.body}
                </Markdown>
              </div>
            ) : (
              <div className="mt-5 text-sm text-muted-foreground">No release notes were provided.</div>
            )}
          </article>
          )
        })
      ) : null}
    </div>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.649.5.5 5.649.5 12A11.5 11.5 0 0 0 8.36 22.04c.575.106.785-.25.785-.556 0-.274-.01-1-.015-1.962-3.181.691-3.853-1.532-3.853-1.532-.52-1.322-1.27-1.674-1.27-1.674-1.038-.71.08-.695.08-.695 1.148.08 1.752 1.178 1.752 1.178 1.02 1.748 2.676 1.243 3.328.95.103-.738.399-1.243.725-1.53-2.54-.289-5.211-1.27-5.211-5.65 0-1.248.446-2.27 1.177-3.07-.118-.288-.51-1.45.112-3.024 0 0 .96-.307 3.145 1.173A10.91 10.91 0 0 1 12 6.03c.973.004 1.954.132 2.87.387 2.182-1.48 3.14-1.173 3.14-1.173.625 1.573.233 2.736.115 3.024.734.8 1.175 1.822 1.175 3.07 0 4.39-2.676 5.358-5.224 5.642.41.353.776 1.05.776 2.117 0 1.528-.014 2.761-.014 3.136 0 .309.207.668.79.555A11.502 11.502 0 0 0 23.5 12C23.5 5.649 18.351.5 12 .5Z" />
    </svg>
  )
}

function formatInstallCount(count: number) {
  if (!count || count <= 0) return "0 installs"
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M installs`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K installs`
  return `${count} install${count === 1 ? "" : "s"}`
}

function SkillErrorBlock({ message }: { message: string }) {
  return (
    <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
      {message}
    </pre>
  )
}

function InstalledSkillCard({
  skill,
  uninstalling,
  onUninstall,
}: {
  skill: InstalledSkillSummary
  uninstalling: boolean
  onUninstall: () => void
}) {
  const href = skill.source ? `https://skills.sh/${skill.source}/${skill.name}` : null

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{skill.name}</div>
        <div className="truncate text-xs text-muted-foreground">{skill.source || "Unknown source"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${skill.name} on skills.sh`}
            className="touch-manipulation inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <button
          type="button"
          aria-label={`Uninstall ${skill.name}`}
          disabled={uninstalling}
          onClick={onUninstall}
          className="touch-manipulation inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
        >
          {uninstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function SkillResultCard({
  skill,
  installing,
  installed,
  message,
  onInstall,
}: {
  skill: SkillSearchResult
  installing: boolean
  installed: boolean
  message?: string
  onInstall: () => void
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{skill.name}</div>
        <div className="truncate text-xs text-muted-foreground">{skill.source} · {formatInstallCount(skill.installs)}</div>
        {installed && message ? <div className="mt-1 truncate text-xs text-emerald-500">{message}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={`https://skills.sh/${skill.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`View ${skill.name} on skills.sh`}
          className="touch-manipulation inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <Button
          type="button"
          size="sm"
          variant={installed ? "secondary" : "default"}
          disabled={installing || installed}
          onClick={onInstall}
          className="h-6 rounded-full px-2 text-xs"
        >
          {installing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {installed ? "Installed" : installing ? "Installing" : "Get"}
        </Button>
      </div>
    </div>
  )
}

export function SkillsSection({
  state,
  defaultProvider,
}: {
  state: Pick<KannaState, "connectionStatus" | "socket" | "activeProjectId">
  defaultProvider?: AgentProvider
}) {
  const socket = state.socket
  const connectionStatus = state.connectionStatus

  // Claude-specific states
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SkillSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [installedSkills, setInstalledSkills] = useState<InstalledSkillSummary[]>([])
  const [installedSkillIds, setInstalledSkillIds] = useState<Set<string>>(() => new Set())
  const [installedLoading, setInstalledLoading] = useState(false)
  const [installedError, setInstalledError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null)
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null)
  const [installMessages, setInstallMessages] = useState<Record<string, string>>({})

  // Discovered skills states (for Pi, Antigravity, Codex)
  interface DiscoveredSkill {
    name: string
    folderName: string
    isLocal: boolean
    enabled: boolean
    path: string
  }
  const [discoveredSkills, setDiscoveredSkills] = useState<DiscoveredSkill[]>([])
  const [originalDiscoveredSkills, setOriginalDiscoveredSkills] = useState<DiscoveredSkill[]>([])
  const [discoveredLoading, setDiscoveredLoading] = useState(false)
  const [discoveredError, setDiscoveredError] = useState<string | null>(null)
  const [discoveredSaving, setDiscoveredSaving] = useState(false)
  const [discoveredSearchQuery, setDiscoveredSearchQuery] = useState("")

  async function loadInstalledSkills() {
    if (connectionStatus !== "connected") {
      setInstalledSkills([])
      setInstalledSkillIds(new Set())
      setInstalledError(null)
      setInstalledLoading(false)
      return
    }

    try {
      setInstalledLoading(true)
      setInstalledError(null)
      const snapshot = await socket.command<InstalledSkillsSnapshot>({ type: "skills.listInstalled" })
      setInstalledSkills(snapshot.skills)
      setInstalledSkillIds(new Set(snapshot.skills.map((skill) => skill.name)))
    } catch (error) {
      setInstalledSkills([])
      setInstalledSkillIds(new Set())
      setInstalledError(error instanceof Error ? error.message : "Unable to read installed skills.")
    } finally {
      setInstalledLoading(false)
    }
  }

  async function loadDiscoveredSkills() {
    if (connectionStatus !== "connected") {
      setDiscoveredSkills([])
      setOriginalDiscoveredSkills([])
      return
    }
    try {
      setDiscoveredLoading(true)
      setDiscoveredError(null)
      const result = await socket.command<DiscoveredSkill[]>({
        type: "settings.listSkills",
        agent: defaultProvider,
        projectId: state.activeProjectId || undefined,
      })
      setDiscoveredSkills(result)
      setOriginalDiscoveredSkills(result)
    } catch (err) {
      setDiscoveredError(err instanceof Error ? err.message : String(err))
      setDiscoveredSkills([])
      setOriginalDiscoveredSkills([])
    } finally {
      setDiscoveredLoading(false)
    }
  }

  useEffect(() => {
    if (defaultProvider === "pi" || defaultProvider === "antigravity" || defaultProvider === "codex") {
      void loadDiscoveredSkills()
    } else if (defaultProvider === "claude" || !defaultProvider) {
      void loadInstalledSkills()
    }
  }, [connectionStatus, socket, defaultProvider, state.activeProjectId])

  const handleToggleDiscoveredSkill = (skillPath: string) => {
    setDiscoveredSkills((current) =>
      current.map((s) => (s.path === skillPath ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const hasDiscoveredChanges = JSON.stringify(discoveredSkills) !== JSON.stringify(originalDiscoveredSkills)

  const handleResetDiscovered = () => {
    setDiscoveredSkills(originalDiscoveredSkills)
  }

  async function handleSaveDiscovered() {
    if (connectionStatus !== "connected") return
    try {
      setDiscoveredSaving(true)
      setDiscoveredError(null)
      await socket.command({
        type: "settings.saveSkills",
        agent: defaultProvider,
        skills: discoveredSkills,
      })
      setOriginalDiscoveredSkills(discoveredSkills)
    } catch (err) {
      setDiscoveredError(err instanceof Error ? err.message : String(err))
    } finally {
      setDiscoveredSaving(false)
    }
  }

  async function installSkill(skill: SkillSearchResult) {
    if (connectionStatus !== "connected") {
      setOperationError("Backend connection required.")
      return
    }

    try {
      setInstallingSkillId(skill.id)
      setOperationError(null)
      setInstallMessages((current) => {
        const next = { ...current }
        delete next[skill.id]
        return next
      })
      await socket.command<SkillInstallResult>({
        type: "skills.install",
        source: skill.source,
        skillId: skill.skillId,
      })
      setInstalledSkillIds((current) => new Set(current).add(skill.skillId))
      setInstallMessages((current) => ({
        ...current,
        [skill.id]: "Installed globally",
      }))
      void loadInstalledSkills()
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Install failed.")
    } finally {
      setInstallingSkillId(null)
    }
  }

  async function uninstallSkill(skill: InstalledSkillSummary) {
    if (connectionStatus !== "connected") {
      setOperationError("Backend connection required.")
      return
    }

    try {
      setUninstallingSkillId(skill.name)
      setOperationError(null)
      await socket.command<SkillUninstallResult>({
        type: "skills.uninstall",
        skillId: skill.name,
      })
      setInstalledSkills((current) => current.filter((installedSkill) => installedSkill.name !== skill.name))
      setInstalledSkillIds((current) => {
        const next = new Set(current)
        next.delete(skill.name)
        return next
      })
      setInstallMessages((current) => {
        const next = { ...current }
        for (const key of Object.keys(next)) {
          if (key.endsWith(`/${skill.name}`) || key === skill.name) {
            delete next[key]
          }
        }
        return next
      })
      void loadInstalledSkills()
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Uninstall failed.")
    } finally {
      setUninstallingSkillId(null)
    }
  }

  useEffect(() => {
    if (defaultProvider !== "claude" && defaultProvider !== "codex" && defaultProvider) {
      return
    }
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 2) {
      setResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    if (connectionStatus !== "connected") {
      setResults([])
      setSearchLoading(false)
      setSearchError("Backend connection required.")
      return
    }

    let cancelled = false
    setSearchLoading(true)
    setSearchError(null)

    const timeout = window.setTimeout(() => {
      void socket.command<SkillSearchSnapshot>({
        type: "skills.search",
        query: normalizedQuery,
        limit: 100,
      })
        .then((snapshot) => {
          if (cancelled) return
          setResults(snapshot.skills)
        })
          .catch((error) => {
            if (cancelled) return
            setResults([])
            setSearchError(error instanceof Error ? error.message : "Unable to search skills.")
          })
          .finally(() => {
            if (cancelled) return
            setSearchLoading(false)
          })
      }, 250)

      return () => {
        cancelled = true
        window.clearTimeout(timeout)
      }
  }, [connectionStatus, query, socket, defaultProvider])

  if (defaultProvider === "pi" || defaultProvider === "antigravity" || defaultProvider === "codex") {
    const discTotal = discoveredSkills.length
    const discEnabled = discoveredSkills.filter(s => s.enabled).length
    const discDisabled = discoveredSkills.filter(s => !s.enabled).length
    const discTokenBloat = discEnabled * 80
    const discTokenSeverity = discTokenBloat > 3000 ? "high" : discTokenBloat > 1200 ? "medium" : "low"
    const discSeverityText = discTokenSeverity === "high" ? "High Context Bloat" : discTokenSeverity === "medium" ? "Moderate Context Bloat" : "Optimal Context Usage"
    const discSeverityColor = discTokenSeverity === "high" ? "text-red-500 bg-red-500/10 border-red-500/20" : discTokenSeverity === "medium" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"

    const filteredDiscovered = discoveredSkills.filter((s) =>
      s.name.toLowerCase().includes(discoveredSearchQuery.toLowerCase())
    )

    return (
      <div className="flex flex-col gap-6">
        {discoveredError && <div className="text-xs text-destructive">{discoveredError}</div>}

        {/* Change Banner */}
        {hasDiscoveredChanges && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-4 flex items-center justify-between gap-4 animate-in fade-in-50 duration-150">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-foreground font-sans">Unsaved Changes</div>
                <div className="mt-1 text-sm text-muted-foreground leading-relaxed font-sans">
                  Bạn có thay đổi chưa lưu trên cấu hình Skills. Hãy lưu hoặc reset lại.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDiscovered}
                disabled={discoveredSaving}
              >
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveDiscovered()}
                disabled={discoveredSaving}
              >
                {discoveredSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Telemetry/Stats Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground font-sans">Total Skills</span>
              <BookText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{discTotal}</span>
              <span className="text-xs text-muted-foreground font-sans">skills</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground font-sans">Status Distribution</span>
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="h-2 w-2 rounded-full bg-muted" />
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-sans">Enabled</span>
                <span className="font-semibold text-emerald-500">{discEnabled}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-sans">Disabled</span>
                <span className="font-semibold text-muted-foreground">{discDisabled}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground font-sans">Est. Token Bloat</span>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">~{discTokenBloat}</span>
                <span className="text-[10px] text-muted-foreground font-sans">tokens</span>
              </div>
              <span className={cn("inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border font-sans", discSeverityColor)}>
                {discSeverityText}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground font-sans">Discovered Skills</div>
            {discoveredLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card/30 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              role="searchbox"
              value={discoveredSearchQuery}
              onChange={(event) => setDiscoveredSearchQuery(event.target.value)}
              placeholder="Search discovered skills..."
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {discoveredSearchQuery ? (
              <button
                type="button"
                aria-label="Clear skills search"
                onClick={() => setDiscoveredSearchQuery("")}
                className="touch-manipulation inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {filteredDiscovered.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredDiscovered.map((skill) => (
                <div key={skill.path} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <BookText className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground" title={skill.name}>{skill.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {skill.isLocal ? "Project Skill" : "Global Skill"}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleToggleDiscoveredSkill(skill.path)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0 animate-in fade-in duration-100"
                    title={skill.enabled ? "Disable skill" : "Enable skill"}
                  >
                    {skill.enabled ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <ToggleRight className="h-6 w-6" /> Enabled
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <ToggleLeft className="h-6 w-6" /> Disabled
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : !discoveredLoading ? (
            <div className="rounded-lg border border-border bg-card/20 p-3 text-sm text-muted-foreground font-sans">
              No skills found matching search criteria.
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  if (defaultProvider && defaultProvider !== "claude" && defaultProvider !== "codex" && defaultProvider !== "pi" && defaultProvider !== "antigravity") {
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-6 py-5">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Skills Not Supported</div>
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {`${defaultProvider} Agent không hỗ trợ cấu hình Custom Skills trên Kanna.`}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const skillCount = installedSkills.length
  const tokenBloat = skillCount * 80
  const tokenSeverity = tokenBloat > 3000 ? "high" : tokenBloat > 1200 ? "medium" : "low"
  const severityText = tokenSeverity === "high" ? "High Context Bloat" : tokenSeverity === "medium" ? "Moderate Context Bloat" : "Optimal Context Usage"
  const severityColor = tokenSeverity === "high" ? "text-red-500 bg-red-500/10 border-red-500/20" : tokenSeverity === "medium" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"

  return (
    <div className="flex flex-col gap-6">
      {operationError ? <SkillErrorBlock message={operationError} /> : null}

      {/* Telemetry/Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground font-sans">Total Skills</span>
            <BookText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{skillCount}</span>
            <span className="text-xs text-muted-foreground font-sans">global skills</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground font-sans">Status Distribution</span>
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="h-2 w-2 rounded-full bg-muted" />
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-sans">Enabled</span>
              <span className="font-semibold text-emerald-500">{skillCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-sans">Disabled</span>
              <span className="font-semibold text-muted-foreground">0</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground font-sans">Est. Token Bloat</span>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">~{tokenBloat}</span>
              <span className="text-[10px] text-muted-foreground font-sans">tokens</span>
            </div>
            <span className={cn("inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border font-sans", severityColor)}>
              {severityText}
            </span>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground font-sans">Installed</div>
          {installedLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
        </div>
        {installedError ? <div className="text-xs text-destructive">{installedError}</div> : null}
        {installedSkills.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {installedSkills.map((skill) => (
              <div key={`${skill.source}/${skill.name}`} className="relative group">
                <InstalledSkillCard
                  skill={skill}
                  uninstalling={uninstallingSkillId === skill.name}
                  onUninstall={() => { void uninstallSkill(skill) }}
                />
                <span className="absolute top-3 right-12 px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                  Enabled
                </span>
              </div>
            ))}
          </div>
        ) : !installedLoading ? (
          <div className="rounded-lg border border-border bg-card/30 p-3 text-sm text-muted-foreground font-sans">
            No global skills installed.
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="text-sm font-medium text-foreground font-sans">Discover</div>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card/30 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear skills search"
              onClick={() => setQuery("")}
              className="touch-manipulation inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {searchLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
        </div>
        {searchError ? <div className="text-xs text-destructive">{searchError}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((skill) => (
            <SkillResultCard
              key={skill.id}
              skill={skill}
              installing={installingSkillId === skill.id}
              installed={installedSkillIds.has(skill.skillId)}
              message={installMessages[skill.id]}
              onInstall={() => { void installSkill(skill) }}
            />
          ))}
        </div>
        {!searchLoading && !searchError && query.trim().length >= 2 && results.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/30 p-3 text-sm text-muted-foreground font-sans">
            No skills found.
          </div>
        ) : null}
      </section>
    </div>
  )
}

function CodePill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-card/50 px-2 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  )
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "good"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
          : "border-border bg-card/50 text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

function AgentCliDetectionPill({
  agent,
}: {
  agent: AgentCliDetectionSnapshot["agents"][number] | undefined
}) {
  if (!agent) {
    return <StatusPill>Checking CLI</StatusPill>
  }

  if (agent.status === "detected") {
    return <StatusPill tone="good">Detected: {agent.command}</StatusPill>
  }

  if (agent.status === "built_in") {
    return <StatusPill tone="good">Built in</StatusPill>
  }

  return <StatusPill>CLI missing: {agent.candidateCommands.join(" / ")}</StatusPill>
}

const DEFAULT_CUSTOM_AGENT_ADVANCED = {
  yolo_id: "",
  native_skills_dirs: [],
  behavior_policy: {
    supports_side_question: false,
  },
  description: "",
}

function createCustomAgentId(displayName: string) {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `custom-${slug || "agent"}-${Date.now().toString(36)}`
}

function CustomAgentCard({ agent }: { agent: CustomAgentConfig }) {
  return (
    <div className="rounded-lg border border-border bg-card/30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{agent.displayName}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {agent.command}{agent.args ? ` ${agent.args}` : ""}
          </div>
        </div>
        <StatusPill tone={agent.enabled ? "good" : "neutral"}>{agent.enabled ? "Enabled" : "Disabled"}</StatusPill>
      </div>
      {agent.advanced.description ? (
        <div className="mt-2 text-sm text-muted-foreground">{agent.advanced.description}</div>
      ) : null}
    </div>
  )
}

function parseWorkflowScalar(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((entry) => String(parseWorkflowScalar(entry.trim()))).filter(Boolean)
  }
  return trimmed
}

function parseSimpleWorkflowFrontmatter(frontmatter: string) {
  const result: Record<string, any> = {}
  let currentArrayKey: string | null = null
  let currentArrayItem: Record<string, unknown> | null = null

  for (const rawLine of frontmatter.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue
    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0
    const line = rawLine.trim()

    if (indent === 0) {
      const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line)
      if (!match) continue
      const [, key, value = ""] = match
      if (value.trim()) {
        result[key] = parseWorkflowScalar(value)
        currentArrayKey = null
        currentArrayItem = null
      } else {
        result[key] = []
        currentArrayKey = key
        currentArrayItem = null
      }
      continue
    }

    if (!currentArrayKey) continue
    if (!Array.isArray(result[currentArrayKey])) result[currentArrayKey] = []

    if (indent >= 2 && line.startsWith("- ")) {
      const itemText = line.slice(2).trim()
      const item: Record<string, unknown> = {}
      const pair = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(itemText)
      if (pair) item[pair[1]] = parseWorkflowScalar(pair[2] ?? "")
      else if (itemText) item.value = parseWorkflowScalar(itemText)
      result[currentArrayKey].push(item)
      currentArrayItem = item
      continue
    }

    if (indent >= 4 && currentArrayItem) {
      const pair = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line)
      if (pair) currentArrayItem[pair[1]] = parseWorkflowScalar(pair[2] ?? "")
    }
  }

  return result
}

export function parseWorkflowImportText(text: string) {
  const trimmed = text.trim()
  const warnings: string[] = []
  if (!trimmed) throw new Error("Workflow Markdown or manifest JSON is required.")

  if (trimmed.startsWith("{")) {
    return { manifest: JSON.parse(trimmed), warnings }
  }

  const frontmatterMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n([\s\S]*))?$/.exec(trimmed)
  if (!frontmatterMatch) {
    throw new Error("Workflow Markdown must include YAML frontmatter delimited by --- markers, or be valid manifest JSON.")
  }

  const manifest = parseSimpleWorkflowFrontmatter(frontmatterMatch[1])
  const body = frontmatterMatch[2] ?? ""
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : []
  const inputs = Array.isArray(manifest.inputs) ? manifest.inputs : []
  const outputs = Array.isArray(manifest.outputs) ? manifest.outputs : []
  const declaredPatterns = new Set(
    [...artifacts, ...inputs, ...outputs]
      .flatMap((entry) => [
        typeof entry?.pattern === "string" ? entry.pattern : undefined,
        typeof entry?.path === "string" ? entry.path : undefined,
      ])
      .filter(Boolean)
  )
  const referencedFiles = new Set(body.match(/[A-Z][A-Z0-9_/*-]*\.(?:md|json|csv)/g) ?? [])
  for (const file of referencedFiles) {
    const declared = [...declaredPatterns].some((pattern) => {
      if (pattern === file) return true
      const regex = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$")
      return regex.test(file)
    })
    if (!declared) warnings.push(`Body references ${file}, but it is not declared in frontmatter artifacts.`)
  }

  if (typeof manifest.name !== "string" || !manifest.name.trim()) throw new Error("Workflow frontmatter must declare name.")
  if (typeof manifest.version !== "string" || !manifest.version.trim()) throw new Error("Workflow frontmatter must declare version.")
  if (!Array.isArray(manifest.artifacts)) manifest.artifacts = []

  return { manifest, warnings }
}

function formatWorkflowManifest(manifest: Record<string, any> | undefined, options?: { bumpPatchVersion?: boolean }) {
  const nextManifest = { ...(manifest ?? {}) }
  if (options?.bumpPatchVersion && typeof nextManifest.version === "string") {
    const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(nextManifest.version)
    if (match) {
      nextManifest.version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}${match[4] ?? ""}`
    }
  }
  return JSON.stringify(nextManifest, null, 2)
}

export function WorkflowSection({ state }: { state: KannaState }) {
  const [definitions, setDefinitions] = useState<WorkflowDefinitionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [globalAutonomy, setGlobalAutonomy] = useState<string>(() => {
    return localStorage.getItem("kanna:globalReviewAutonomy") || "manual_review"
  })

  const handleSetGlobalAutonomy = (value: string) => {
    setGlobalAutonomy(value)
    localStorage.setItem("kanna:globalReviewAutonomy", value)
  }

  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<"upload" | "write">("upload")
  const [importSlug, setImportSlug] = useState("")
  const [importName, setImportName] = useState("")
  const [importDesc, setImportDesc] = useState("")
  const [importManifestText, setImportManifestText] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [parsedPreview, setParsedPreview] = useState<Record<string, any> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deletingDefinitionId, setDeletingDefinitionId] = useState<string | null>(null)
  const [workflowDetailsMode, setWorkflowDetailsMode] = useState<"view" | "edit" | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinitionSummary | null>(null)
  const [workflowManifestText, setWorkflowManifestText] = useState("")
  const [workflowDetailsError, setWorkflowDetailsError] = useState<string | null>(null)
  const [isSavingWorkflowDetails, setIsSavingWorkflowDetails] = useState(false)
  const [sourceWorkflow, setSourceWorkflow] = useState<WorkflowDefinitionSummary | null>(null)
  const [sourceFilePath, setSourceFilePath] = useState("")
  const [sourceFileText, setSourceFileText] = useState("")
  const [sourceFileError, setSourceFileError] = useState<string | null>(null)
  const [isLoadingSourceFile, setIsLoadingSourceFile] = useState(false)
  const [isSavingSourceFile, setIsSavingSourceFile] = useState(false)

  const projectId = state.activeProjectId

  // Find active project title
  const activeProject = state.sidebarData.projectGroups.find(p => p.groupKey === projectId)
  const projectTitle = activeProject?.title || "Active Project"

  const loadDefinitions = () => {
    state.socket.command<WorkflowDefinitionSummary[]>({
      type: "workflow.listDefinitions",
      projectId: projectId ?? undefined,
    })
      .then((defs) => {
        setDefinitions(defs)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load definitions:", err)
        setIsLoading(false)
      })
  }

  useEffect(() => {
    loadDefinitions()
    if (projectId) {
      const unsubscribe = state.socket.subscribe<any>(
        { type: "project-workflow", projectId },
        () => {
          loadDefinitions()
        }
      )
      return unsubscribe
    }
  }, [projectId, state.socket])

  const handleToggleRegister = async (def: WorkflowDefinitionSummary) => {
    if (!projectId) return
    try {
      if (def.isRegistered) {
        await state.socket.command({
          type: "project.unregisterWorkflow",
          projectId,
          workflowDefinitionId: def.id,
        })
      } else {
        await state.socket.command({
          type: "project.registerWorkflow",
          projectId,
          workflowDefinitionId: def.id,
          versionId: def.currentVersionId,
          isDefaultEntrypoint: false,
        })
      }
      loadDefinitions()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteDefinition = async (def: WorkflowDefinitionSummary) => {
    if (!projectId) return
    const confirmed = window.confirm(`Delete "${def.name}" from the workflow catalog? This cannot be undone.`)
    if (!confirmed) return

    try {
      setDeletingDefinitionId(def.id)
      await state.socket.command({
        type: "workflow.deleteDefinition",
        projectId,
        workflowDefinitionId: def.id,
      })
      loadDefinitions()
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingDefinitionId(null)
    }
  }

  const handleToggleEnabled = async (def: WorkflowDefinitionSummary) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.updateWorkflowRegistration",
        projectId,
        workflowDefinitionId: def.id,
        patch: { enabled: !def.isEnabled },
      })
      loadDefinitions()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSetDefault = async (def: WorkflowDefinitionSummary) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.updateWorkflowRegistration",
        projectId,
        workflowDefinitionId: def.id,
        patch: { isDefaultEntrypoint: true },
      })
      loadDefinitions()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePinVersion = async (def: WorkflowDefinitionSummary, value: string) => {
    if (!projectId) return
    try {
      const versionId = value === "latest" ? null : value
      await state.socket.command({
        type: "project.updateWorkflowRegistration",
        projectId,
        workflowDefinitionId: def.id,
        patch: { versionId: versionId ?? undefined },
      })
      loadDefinitions()
    } catch (err) {
      console.error(err)
    }
  }

  const handleSetAutonomyOverride = async (def: WorkflowDefinitionSummary, value: string) => {
    if (!projectId) return
    try {
      const currentSettings = def.settings || {}
      const updatedSettings = {
        ...currentSettings,
        autonomyLevel: value === "default" ? undefined : value
      }
      if (updatedSettings.autonomyLevel === undefined) {
        delete updatedSettings.autonomyLevel
      }
      await state.socket.command({
        type: "project.updateWorkflowRegistration",
        projectId,
        workflowDefinitionId: def.id,
        patch: { settings: updatedSettings },
      })
      loadDefinitions()
    } catch (err) {
      console.error(err)
    }
  }

  const openWorkflowDetails = (def: WorkflowDefinitionSummary, mode: "view" | "edit") => {
    setSelectedWorkflow(def)
    setWorkflowDetailsMode(mode)
    setWorkflowDetailsError(null)
    setWorkflowManifestText(formatWorkflowManifest(def.manifest, { bumpPatchVersion: mode === "edit" }))
  }

  const closeWorkflowDetails = (force = false) => {
    if (isSavingWorkflowDetails && !force) return
    setWorkflowDetailsMode(null)
    setSelectedWorkflow(null)
    setWorkflowManifestText("")
    setWorkflowDetailsError(null)
  }

  const openWorkflowSourceEditor = async (def: WorkflowDefinitionSummary) => {
    const firstSourceFile = def.sourceFiles?.[0]
    if (!firstSourceFile) return
    setSourceWorkflow(def)
    setSourceFilePath(firstSourceFile)
    setSourceFileText("")
    setSourceFileError(null)
    setIsLoadingSourceFile(true)
    try {
      const content = await state.socket.command<string>({
        type: "workflow.readSourceFile",
        projectId: projectId ?? undefined,
        workflowDefinitionId: def.id,
        sourcePath: firstSourceFile,
      })
      setSourceFileText(content)
    } catch (err: any) {
      setSourceFileError(err.message || String(err))
    } finally {
      setIsLoadingSourceFile(false)
    }
  }

  const closeWorkflowSourceEditor = (force = false) => {
    if (isSavingSourceFile && !force) return
    setSourceWorkflow(null)
    setSourceFilePath("")
    setSourceFileText("")
    setSourceFileError(null)
  }

  const loadSelectedSourceFile = async (nextPath: string) => {
    if (!sourceWorkflow) return
    setSourceFilePath(nextPath)
    setSourceFileError(null)
    setIsLoadingSourceFile(true)
    try {
      const content = await state.socket.command<string>({
        type: "workflow.readSourceFile",
        projectId: projectId ?? undefined,
        workflowDefinitionId: sourceWorkflow.id,
        sourcePath: nextPath,
      })
      setSourceFileText(content)
    } catch (err: any) {
      setSourceFileError(err.message || String(err))
    } finally {
      setIsLoadingSourceFile(false)
    }
  }

  const handleSaveWorkflowSourceFile = async (options?: { publishVersion?: boolean }) => {
    if (!sourceWorkflow || !sourceFilePath) return
    setIsSavingSourceFile(true)
    setSourceFileError(null)
    try {
      await state.socket.command({
        type: "workflow.writeSourceFile",
        projectId: projectId ?? undefined,
        workflowDefinitionId: sourceWorkflow.id,
        sourcePath: sourceFilePath,
        content: sourceFileText,
      })

      if (options?.publishVersion) {
        const parsed = parseWorkflowImportText(sourceFileText)
        await state.socket.command({
          type: "workflow.publishManifest",
          projectId: projectId ?? undefined,
          manifest: {
            ...parsed.manifest,
            name: sourceWorkflow.name,
            description: typeof parsed.manifest.description === "string" ? parsed.manifest.description : sourceWorkflow.description ?? "",
            sourceFiles: sourceWorkflow.sourceFiles,
          },
          sourceMarkdown: sourceFileText,
        })
      }

      closeWorkflowSourceEditor(true)
      loadDefinitions()
    } catch (err: any) {
      setSourceFileError(err.message || String(err))
    } finally {
      setIsSavingSourceFile(false)
    }
  }

  const handleSaveWorkflowDetails = async () => {
    if (!selectedWorkflow) return
    setIsSavingWorkflowDetails(true)
    setWorkflowDetailsError(null)
    try {
      const parsed = JSON.parse(workflowManifestText)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Workflow manifest must be a JSON object.")
      }
      if (typeof parsed.version !== "string" || !parsed.version.trim()) {
        throw new Error("Workflow manifest must include a version.")
      }

      await state.socket.command({
        type: "workflow.publishManifest",
        projectId: projectId ?? undefined,
        manifest: {
          ...parsed,
          name: selectedWorkflow.name,
          description: typeof parsed.description === "string" ? parsed.description : selectedWorkflow.description ?? "",
          sourceFiles: selectedWorkflow.sourceFiles,
        },
        sourceMarkdown: workflowManifestText,
      })

      closeWorkflowDetails(true)
      loadDefinitions()
    } catch (err: any) {
      setWorkflowDetailsError(err.message || String(err))
    } finally {
      setIsSavingWorkflowDetails(false)
    }
  }

  const processImportText = useCallback((text: string) => {
    setImportError(null)
    setImportWarnings([])
    setParsedPreview(null)
    if (!text.trim()) return
    try {
      const parsed = parseWorkflowImportText(text)
      setImportWarnings(parsed.warnings)
      setParsedPreview(parsed.manifest)
      // Auto-fill fields from parsed manifest if empty
      if (!importSlug && parsed.manifest.name) {
        setImportSlug(String(parsed.manifest.name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
      }
      if (!importName && parsed.manifest.name) setImportName(String(parsed.manifest.name))
      if (!importDesc && parsed.manifest.description) setImportDesc(String(parsed.manifest.description))
    } catch (err: any) {
      setImportError(err.message || String(err))
    }
  }, [importSlug, importName, importDesc])

  const handleFileContent = useCallback((content: string, fileName: string) => {
    setImportManifestText(content)
    setUploadedFileName(fileName)
    setImportError(null)
    setImportWarnings([])
    // Reset fields so auto-fill can repopulate
    setImportSlug("")
    setImportName("")
    setImportDesc("")
    // Parse after state reset
    try {
      const parsed = parseWorkflowImportText(content)
      setImportWarnings(parsed.warnings)
      setParsedPreview(parsed.manifest)
      if (parsed.manifest.name) {
        setImportSlug(String(parsed.manifest.name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
        setImportName(String(parsed.manifest.name))
      }
      if (parsed.manifest.description) setImportDesc(String(parsed.manifest.description))
    } catch (err: any) {
      setImportError(err.message || String(err))
    }
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".md") && !file.name.endsWith(".json")) {
      setImportError("Only .md and .json files are supported.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result
      if (typeof content === "string") handleFileContent(content, file.name)
    }
    reader.readAsText(file)
  }, [handleFileContent])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".md") && !file.name.endsWith(".json")) {
      setImportError("Only .md and .json files are supported.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result
      if (typeof content === "string") handleFileContent(content, file.name)
    }
    reader.readAsText(file)
  }, [handleFileContent])

  const resetImportState = useCallback(() => {
    setImportMode("upload")
    setImportSlug("")
    setImportName("")
    setImportDesc("")
    setImportManifestText("")
    setImportError(null)
    setImportWarnings([])
    setUploadedFileName(null)
    setParsedPreview(null)
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleImport = async () => {
    setIsImporting(true)
    setImportError(null)
    setImportWarnings([])
    try {
      const parsed = parseWorkflowImportText(importManifestText)
      setImportWarnings(parsed.warnings)

      const manifestPayload = {
        ...parsed.manifest,
        slug: importSlug || parsed.manifest.slug || parsed.manifest.name || "custom-slug",
        name: importName || parsed.manifest.name || "Custom Workflow",
        description: importDesc || parsed.manifest.description || "",
      }

      await state.socket.command({
        type: "workflow.publishManifest",
        projectId: projectId ?? undefined,
        manifest: manifestPayload,
        sourceMarkdown: importManifestText,
      })

      setIsImportOpen(false)
      resetImportState()
      loadDefinitions()
    } catch (err: any) {
      setImportError(err.message || String(err))
    } finally {
      setIsImporting(false)
    }
  }

  const getReadinessIcon = (readiness?: string) => {
    switch (readiness) {
      case "ready":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "blocked":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "running":
        return <RefreshCw className="h-4 w-4 text-sky-500 animate-spin" />
      case "needs_review":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case "can_repair":
        return <Settings className="h-4 w-4 text-indigo-400 animate-pulse" />
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Workflow Registry</h3>
          <p className="text-sm text-muted-foreground">
            Manage global workflow definitions and register them to your active project with specific version pinning and entrypoints.
          </p>
        </div>
        <Button onClick={() => setIsImportOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Import Workflow
        </Button>
      </div>

      {projectId ? (
        <div className="rounded-lg border border-border bg-card/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active project scope: <strong className="text-foreground">{projectTitle}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Global Review Autonomy:</span>
            <select
              value={globalAutonomy}
              onChange={(e) => handleSetGlobalAutonomy(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2.5 py-1 focus:ring-primary focus:border-primary text-foreground"
            >
              <option value="manual_review">Manual Review (Default)</option>
              <option value="ai_recommend_user_approve">AI Recommend, User Approve</option>
              <option value="ai_auto_approve_low_risk">AI Auto-Approve Low Risk</option>
              <option value="ai_auto_approve_all">AI Auto-Approve All</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-600 dark:text-yellow-400 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            Workflow import is available globally in Settings. Select a project from the sidebar to register workflows, pin versions, and view readiness states.
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Loading workflow definitions...</span>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card/20">
          <div className="grid grid-cols-1 divide-y divide-border">
            {definitions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No workflows found. Register or import a workflow definition to get started.
              </div>
            ) : (
              definitions.map((def) => {
                const canDeleteDefinition = Boolean(projectId && !def.isOfficialGlobal)
                const availableVersions = [
                  { id: "latest", label: `Latest (${def.currentVersion || "unreleased"})` },
                  ...(def.currentVersionId ? [{ id: def.currentVersionId, label: `Version ${def.currentVersion || "current"}` }] : []),
                  ...(def.pinnedVersionId && def.pinnedVersionId !== def.currentVersionId ? [{ id: def.pinnedVersionId, label: `Pinned (${def.pinnedVersion || "current"})` }] : [])
                ]

                return (
                  <div key={def.id} className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between hover:bg-card/30 transition-colors">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate max-w-[200px]" title={def.name}>{def.name}</span>
                        <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono truncate max-w-[150px]">{def.slug}</code>
                        {def.isDefaultEntrypoint && (
                          <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Default Entrypoint
                          </span>
                        )}
                        {def.isRegistered && def.currentVersionId && def.pinnedVersionId && def.pinnedVersionId !== def.currentVersionId && (
                          <span className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                            <ArrowUpCircle className="h-3.5 w-3.5 text-amber-500" /> Upgrade Available
                          </span>
                        )}
                        {def.readiness && (
                          <span className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1",
                            def.readiness === "ready" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                            def.readiness === "blocked" && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                            def.readiness === "running" && "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
                            def.readiness === "needs_review" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                            def.readiness === "can_repair" && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                          )}>
                            {getReadinessIcon(def.readiness)}
                            {def.readiness.toUpperCase().replace("_", " ")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-[500px]">{def.description || "No description provided."}</p>
                    </div>

                    {projectId && (
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Register Checkbox */}
                        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={def.isRegistered}
                            onChange={() => handleToggleRegister(def)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4 bg-background"
                          />
                          Registered
                        </label>

                        {def.isRegistered && (
                          <>
                            {/* Enable/Disable Toggle */}
                            <button
                              onClick={() => handleToggleEnabled(def)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title={def.isEnabled ? "Disable workflow" : "Enable workflow"}
                            >
                              {def.isEnabled ? (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <ToggleRight className="h-5 w-5" /> Enabled
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <ToggleLeft className="h-5 w-5" /> Disabled
                                </span>
                              )}
                            </button>

                            {/* Default Entrypoint Button */}
                            {!def.isDefaultEntrypoint && (
                              <Button
                                variant="outline"
                                className="text-[11px] h-7 px-2"
                                onClick={() => handleSetDefault(def)}
                              >
                                Set Default
                              </Button>
                            )}

                            {/* Version Lock Select */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Pin:</span>
                              <select
                                value={def.pinnedVersionId || "latest"}
                                onChange={(e) => handlePinVersion(def, e.target.value)}
                                className="text-xs bg-background border border-border rounded px-2 py-1 focus:ring-primary focus:border-primary max-w-[130px] truncate"
                              >
                                {availableVersions.map((v) => (
                                  <option key={v.id} value={v.id}>{v.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* Autonomy Override Select */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Autonomy:</span>
                              <select
                                value={def.settings?.autonomyLevel || "default"}
                                onChange={(e) => handleSetAutonomyOverride(def, e.target.value)}
                                className="text-xs bg-background border border-border rounded px-2 py-1 focus:ring-primary focus:border-primary max-w-[150px] truncate text-foreground"
                              >
                                <option value="default">Use Global</option>
                                <option value="manual_review">Manual Review</option>
                                <option value="ai_recommend_user_approve">AI Recommend</option>
                                <option value="ai_auto_approve_low_risk">Auto Low-Risk</option>
                                <option value="ai_auto_approve_all">Auto All</option>
                              </select>
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-1 border-l border-border pl-3">
                          <button
                            type="button"
                            onClick={() => openWorkflowDetails(def, "view")}
                            title="View workflow manifest"
                            aria-label={`View ${def.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openWorkflowSourceEditor(def)}
                            disabled={def.isOfficialGlobal || !def.sourceFiles?.length}
                            title={
                              def.isOfficialGlobal
                                ? "Official workflow sources cannot be edited"
                                : def.sourceFiles?.length
                                  ? "Edit source workflow file"
                                  : "No source workflow file is attached"
                            }
                            aria-label={`Edit source file for ${def.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                          >
                            <FilePenLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openWorkflowDetails(def, "edit")}
                            disabled={def.isOfficialGlobal}
                            title={def.isOfficialGlobal ? "Official workflows cannot be edited" : "Edit manifest / publish new version"}
                            aria-label={`Edit ${def.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                          >
                            <Code className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDefinition(def)}
                            disabled={!canDeleteDefinition || deletingDefinitionId === def.id}
                            title={canDeleteDefinition ? "Delete workflow definition" : "Official workflows cannot be deleted"}
                            aria-label={`Delete ${def.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                          >
                            {deletingDefinitionId === def.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) resetImportState(); setIsImportOpen(open) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Workflow</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5 pt-4">
            {/* Mode Tabs */}
            <SegmentedControl
              value={importMode}
              onValueChange={(v) => { setImportMode(v); setImportError(null); setImportWarnings([]) }}
              options={[
                { value: "upload" as const, label: "Upload File", icon: Upload },
                { value: "write" as const, label: "Write Manually", icon: Code },
              ]}
              size="sm"
              className="w-full"
              optionClassName="flex-1 justify-center"
            />

            {/* Error & Warnings */}
            {importError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{importError}</span>
              </div>
            )}
            {importWarnings.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                {importWarnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Mode */}
            {importMode === "upload" && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {!uploadedFileName ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                    onDrop={handleFileDrop}
                    className={cn(
                      "group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 text-center transition-all duration-200 cursor-pointer",
                      isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                      isDragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                    )}>
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {isDragging ? "Drop to import" : "Drop a workflow file here"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.md</code> with YAML frontmatter or <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.json</code> manifests
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground/60">or click to browse</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-border bg-card/30 p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                        <FileText className="h-4.5 w-4.5 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{uploadedFileName}</p>
                        <p className="text-xs text-muted-foreground">{(importManifestText.length / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <button
                        type="button"
                        onClick={() => { setUploadedFileName(null); setImportManifestText(""); setParsedPreview(null); setImportError(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Write Mode */}
            {importMode === "write" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Workflow Markdown or JSON</label>
                  <button
                    type="button"
                    onClick={() => {
                      setImportManifestText([
                        "---",
                        "name: my-workflow",
                        "version: 1.0.0",
                        "description: Describe your workflow here",
                        "entrypoint: true",
                        "role: initial",
                        "inputs:",
                        "  - type: file",
                        "    path: INPUT_FILE.md",
                        "outputs:",
                        "  - type: file",
                        "    path: OUTPUT_FILE.md",
                        "artifacts:",
                        "  - id: output",
                        "    name: Output",
                        "    pattern: OUTPUT_FILE.md",
                        "---",
                        "",
                        "# Workflow Instructions",
                        "",
                        "Describe the steps for this workflow here.",
                      ].join("\n"))
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Sparkles className="h-3 w-3" />
                    Insert template
                  </button>
                </div>
                <textarea
                  value={importManifestText}
                  onChange={(e) => setImportManifestText(e.target.value)}
                  onBlur={() => { if (importManifestText.trim()) processImportText(importManifestText) }}
                  placeholder={"---\nname: my-workflow\nversion: 1.0.0\n---\n\nWorkflow instructions here..."}
                  className="w-full h-56 font-mono text-xs p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none resize-none transition-colors"
                />
                {importManifestText.trim() && !parsedPreview && !importError && (
                  <button
                    type="button"
                    onClick={() => processImportText(importManifestText)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Parse & preview
                  </button>
                )}
              </div>
            )}

            {/* Metadata Fields */}
            {(uploadedFileName || importManifestText.trim()) && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Slug</label>
                    <Input
                      placeholder="e.g. create-lesson"
                      value={importSlug}
                      onChange={(e) => setImportSlug(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Display Name</label>
                    <Input
                      placeholder="e.g. Create Lesson"
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <Input
                    placeholder="Brief description of the workflow"
                    value={importDesc}
                    onChange={(e) => setImportDesc(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Parsed Preview */}
            {parsedPreview && (
              <div className="rounded-xl border border-border bg-card/20 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5 bg-muted/30">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Parsed Manifest</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-foreground truncate">{String(parsedPreview.name || "—")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Version</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{String(parsedPreview.version || "—")}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Artifacts</span>
                    <span className="font-medium text-foreground">{Array.isArray(parsedPreview.artifacts) ? parsedPreview.artifacts.length : 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium text-foreground">{String(parsedPreview.role || "normal")}</span>
                  </div>
                  {Array.isArray(parsedPreview.inputs) && parsedPreview.inputs.length > 0 && (
                    <div className="col-span-2 flex items-start gap-2">
                      <ArrowRight className="mt-0.5 h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="text-muted-foreground shrink-0">Inputs</span>
                      <span className="font-mono text-[10px] text-foreground truncate">
                        {parsedPreview.inputs.map((i: any) => i.path || i.value || "?").join(", ")}
                      </span>
                    </div>
                  )}
                  {Array.isArray(parsedPreview.outputs) && parsedPreview.outputs.length > 0 && (
                    <div className="col-span-2 flex items-start gap-2">
                      <ArrowRight className="mt-0.5 h-3 w-3 text-sky-500 shrink-0 rotate-180" />
                      <span className="text-muted-foreground shrink-0">Outputs</span>
                      <span className="font-mono text-[10px] text-foreground truncate">
                        {parsedPreview.outputs.map((o: any) => o.path || o.value || "?").join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { resetImportState(); setIsImportOpen(false) }} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={isImporting || !importManifestText.trim()}
            >
              {isImporting ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Importing…</>
              ) : (
                <><Plus className="mr-2 h-3.5 w-3.5" />Import</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sourceWorkflow !== null} onOpenChange={(open) => { if (!open) closeWorkflowSourceEditor() }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Source Workflow File</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 pt-4">
            {sourceWorkflow && (
              <div className="rounded-lg border border-border bg-card/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{sourceWorkflow.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{sourceWorkflow.slug}</code>
                </div>
                {sourceWorkflow.sourceFiles && sourceWorkflow.sourceFiles.length > 1 ? (
                  <select
                    value={sourceFilePath}
                    onChange={(event) => void loadSelectedSourceFile(event.target.value)}
                    disabled={isLoadingSourceFile || isSavingSourceFile}
                    className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {sourceWorkflow.sourceFiles.map((sourceFile) => (
                      <option key={sourceFile} value={sourceFile}>{sourceFile}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{sourceFilePath}</p>
                )}
              </div>
            )}

            {sourceFileError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{sourceFileError}</span>
              </div>
            )}

            {isLoadingSourceFile ? (
              <div className="flex h-[48vh] items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading source file...
              </div>
            ) : (
              <textarea
                value={sourceFileText}
                onChange={(e) => setSourceFileText(e.target.value)}
                spellCheck={false}
                className="h-[48vh] w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => closeWorkflowSourceEditor()} disabled={isSavingSourceFile}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveWorkflowSourceFile()}
              disabled={isSavingSourceFile || isLoadingSourceFile || !sourceFilePath}
            >
              {isSavingSourceFile ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving...</>
              ) : (
                <><FileText className="mr-2 h-3.5 w-3.5" />Save File</>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => handleSaveWorkflowSourceFile({ publishVersion: true })}
              disabled={isSavingSourceFile || isLoadingSourceFile || !sourceFilePath}
            >
              {isSavingSourceFile ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Publishing...</>
              ) : (
                <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Save File & Publish Version</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workflowDetailsMode !== null} onOpenChange={(open) => { if (!open) closeWorkflowDetails() }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{workflowDetailsMode === "edit" ? "Edit Manifest / Publish New Version" : "View Workflow Manifest"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 pt-4">
            {selectedWorkflow && (
              <div className="rounded-lg border border-border bg-card/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{selectedWorkflow.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{selectedWorkflow.slug}</code>
                  {selectedWorkflow.currentVersion && (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">v{selectedWorkflow.currentVersion}</code>
                  )}
                </div>
                {workflowDetailsMode === "edit" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Saving publishes a new workflow version for this definition. The version field has been bumped automatically when possible.
                  </p>
                )}
              </div>
            )}

            {workflowDetailsError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{workflowDetailsError}</span>
              </div>
            )}

            <textarea
              value={workflowManifestText}
              onChange={(e) => setWorkflowManifestText(e.target.value)}
              readOnly={workflowDetailsMode !== "edit"}
              spellCheck={false}
              className={cn(
                "h-[48vh] w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary",
                workflowDetailsMode !== "edit" && "cursor-default bg-muted/20 focus:border-border focus:ring-0"
              )}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeWorkflowDetails} disabled={isSavingWorkflowDetails}>
              {workflowDetailsMode === "edit" ? "Cancel" : "Close"}
            </Button>
            {workflowDetailsMode === "edit" && (
              <Button size="sm" onClick={handleSaveWorkflowDetails} disabled={isSavingWorkflowDetails || !workflowManifestText.trim()}>
                {isSavingWorkflowDetails ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Save</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type McpServerConfig = ProjectMcpServerConfig
type McpConfig = ProjectMcpConfig

function parseMcpConfig(content: string): McpConfig {
  const parsed = JSON.parse(content) as ProjectMcpConfig
  return {
    ...parsed,
    mcpServers: parsed.mcpServers ?? {},
    tools: parsed.tools ?? {},
    capabilities: parsed.capabilities ?? {},
  }
}

const KANNA_MCP_TOOLS = [
  {
    name: "workflow_list_definitions",
    description: "List workflow definitions available to a Kanna project before starting or registering workflows.",
  },
  {
    name: "workflow_start_run",
    description: "Start a workflow run for a project, optionally with chat context and structured input.",
  },
  {
    name: "workflow_publish_manifest",
    description: "Publish an imported workflow manifest into Kanna's workflow definition store.",
  },
  {
    name: "workflow_get_projection",
    description: "Read the latest projected workflow state, including nodes, artifacts, locks, and impacts.",
  },
  {
    name: "workflow_list_runs",
    description: "List recent workflow runs for a project.",
  },
  {
    name: "workflow_list_events",
    description: "Inspect append-only workflow events for audit and state reconstruction.",
  },
  {
    name: "workflow_append_event",
    description: "Append an integration or audit event to a workflow run.",
  },
  {
    name: "artifact_list",
    description: "List classified project artifacts with optional kind, query, and limit filters.",
  },
  {
    name: "artifact_mark",
    description: "Mark an artifact as invalidated or accepted as the current source of truth.",
  },
  {
    name: "workflow_update_artifact_impact",
    description: "Record review or repair status for downstream artifact impacts.",
  },
] as const

const PROJECT_CAPABILITIES = [
  {
    id: "skills",
    label: "Skills",
    description: "Expose installed skills and the Skill tool to supported agents.",
  },
  {
    id: "workflow",
    label: "Workflow",
    description: "Expose Kanna workflow tools, registry actions, artifact tracking, and workflow runtime operations.",
  },
  {
    id: "mcp",
    label: "MCP",
    description: "Allow project-level MCP servers and tools to be exposed to supported agents.",
  },
] as const

export function McpSection({
  state,
  defaultProvider,
}: {
  state: Pick<KannaState, "activeProjectId" | "sidebarData" | "connectionStatus" | "socket">
  defaultProvider?: AgentProvider
}) {
  const projectId = state.activeProjectId
  const activeProject = state.sidebarData.projectGroups.find(p => p.groupKey === projectId)
  const [config, setConfig] = useState<McpConfig>({ mcpServers: {} })
  const [loading, setLoading] = useState(false)
  const [savingServerName, setSavingServerName] = useState<string | null>(null)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [serverName, setServerName] = useState("custom-server")
  const [serverCommand, setServerCommand] = useState("")
  const [serverArgs, setServerArgs] = useState("")

  // Pi-specific states
  const [piMcpServers, setPiMcpServers] = useState<Record<string, any>>({})
  const [piMcpLoading, setPiMcpLoading] = useState(false)
  const [piMcpError, setPiMcpError] = useState<string | null>(null)

  const servers = Object.entries(config.mcpServers ?? {})

  const loadConfig = async () => {
    if (!projectId || state.connectionStatus !== "connected") {
      setConfig({ mcpServers: {} })
      return
    }
    try {
      setLoading(true)
      setMcpError(null)
      const content = await state.socket.command<string>({
        type: "project.readFile",
        projectId,
        relativePath: ".mcp.json",
      })
      setConfig(parseMcpConfig(content))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("ENOENT") || message.includes("no such file")) {
        setConfig({ mcpServers: {} })
        setMcpError(null)
      } else {
        setMcpError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadPiMcp = async () => {
    if (state.connectionStatus !== "connected") {
      setPiMcpServers({})
      return
    }
    try {
      setPiMcpLoading(true)
      setPiMcpError(null)
      const result = await state.socket.command<Record<string, any>>({ type: "pi.listMcp" })
      setPiMcpServers(result)
    } catch (error) {
      setPiMcpServers({})
      setPiMcpError(error instanceof Error ? error.message : "Unable to read Pi MCP config.")
    } finally {
      setPiMcpLoading(false)
    }
  }

  const openPiMcpDir = async () => {
    try {
      await state.socket.command({
        type: "system.openExternal",
        localPath: "~/.pi/agent",
        action: "open_finder",
      })
    } catch (err) {
      console.error(err)
    }
  }

  const saveConfig = async (nextConfig: McpConfig, savingName?: string) => {
    if (!projectId) return
    try {
      setSavingServerName(savingName ?? "__config__")
      setMcpError(null)
      await state.socket.command({
        type: "project.writeFile",
        projectId,
        relativePath: ".mcp.json",
        content: `${JSON.stringify({
          mcpServers: nextConfig.mcpServers ?? {},
          tools: nextConfig.tools ?? {},
          capabilities: nextConfig.capabilities ?? {},
        }, null, 2)}\n`,
      })
      setConfig(nextConfig)
    } catch (error) {
      setMcpError(error instanceof Error ? error.message : String(error))
    } finally {
      setSavingServerName(null)
    }
  }

  const handleAddServer = async () => {
    const name = serverName.trim()
    const command = serverCommand.trim()
    if (!name || !command) {
      setMcpError("Server name and command are required.")
      return
    }
    const args = serverArgs.trim().length > 0 ? serverArgs.trim().split(/\s+/) : undefined
    const nextConfig = {
      ...config,
      mcpServers: {
        ...(config.mcpServers ?? {}),
        [name]: {
          command,
          ...(args ? { args } : {}),
        },
      },
    }
    await saveConfig(nextConfig, name)
    setServerName("custom-server")
    setServerCommand("")
    setServerArgs("")
  }

  const handleRemoveServer = async (name: string) => {
    const confirmed = window.confirm(`Remove MCP server "${name}" from .mcp.json?`)
    if (!confirmed) return
    const nextServers = { ...(config.mcpServers ?? {}) }
    delete nextServers[name]
    await saveConfig({ ...config, mcpServers: nextServers }, name)
  }

  const handleToggleTool = async (serverName: string, toolName: string) => {
    const currentTools = config.tools ?? {}
    const serverTools = currentTools[serverName] ?? {}
    const nextValue = serverTools[toolName] === false ? true : false

    const nextConfig = {
      ...config,
      tools: {
        ...currentTools,
        [serverName]: {
          ...serverTools,
          [toolName]: nextValue,
        },
      },
    }
    setConfig(nextConfig)
    await saveConfig(nextConfig)
  }

  const handleSetServerTools = async (serverName: string, toolNames: readonly string[], enabled: boolean) => {
    const currentTools = config.tools ?? {}
    const serverTools = currentTools[serverName] ?? {}
    const nextServerTools = { ...serverTools }
    for (const toolName of toolNames) {
      nextServerTools[toolName] = enabled
    }

    const nextConfig = {
      ...config,
      tools: {
        ...currentTools,
        [serverName]: nextServerTools,
      },
    }
    setConfig(nextConfig)
    await saveConfig(nextConfig)
  }

  const handleToggleCapability = async (capability: typeof PROJECT_CAPABILITIES[number]["id"]) => {
    const currentCapabilities = config.capabilities ?? {}
    const nextConfig = {
      ...config,
      capabilities: {
        ...currentCapabilities,
        [capability]: currentCapabilities[capability] === false,
      },
    }
    setConfig(nextConfig)
    await saveConfig(nextConfig)
  }

  useEffect(() => {
    if (defaultProvider === "pi") {
      void loadPiMcp()
    } else if (defaultProvider === "claude" || defaultProvider === "codex" || !defaultProvider) {
      void loadConfig()
    }
  }, [projectId, state.connectionStatus, state.socket, defaultProvider])

  if (defaultProvider === "pi") {
    const totalTools = Object.values(piMcpServers).reduce((acc, serverInfo: any) => acc + (serverInfo.tools?.length ?? 0), 0)
    const tokenBloat = totalTools * 150
    const tokenSeverity = tokenBloat > 3000 ? "high" : tokenBloat > 1200 ? "medium" : "low"
    const severityText = tokenSeverity === "high" ? "High Context Bloat" : tokenSeverity === "medium" ? "Moderate Context Bloat" : "Optimal Context Usage"
    const severityColor = tokenSeverity === "high" ? "text-red-500 bg-red-500/10 border-red-500/20" : tokenSeverity === "medium" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-foreground">Pi Agent Integration</div>
                <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Pi Agent tự quản lý các MCP servers của nó. Dưới đây là các công cụ MCP được phát hiện từ cấu hình của Pi.
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPiMcpDir}
              className="shrink-0 gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Pi Config Directory
            </Button>
          </div>
        </div>

        {/* Telemetry/Stats Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground font-sans">Total MCP Tools</span>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">{totalTools}</span>
              <span className="text-xs text-muted-foreground font-sans">discovered tools</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground font-sans">Status Distribution</span>
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="h-2 w-2 rounded-full bg-muted" />
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-sans">Enabled</span>
                <span className="font-semibold text-emerald-500">{totalTools}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-sans">Disabled</span>
                <span className="font-semibold text-muted-foreground">0</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground font-sans">Est. Token Bloat</span>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">~{tokenBloat}</span>
                <span className="text-[10px] text-muted-foreground font-sans">tokens</span>
              </div>
              <span className={cn("inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border font-sans", severityColor)}>
                {severityText}
              </span>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">Discovered Pi MCP Servers</div>
            {piMcpLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {piMcpError && <div className="text-xs text-destructive">{piMcpError}</div>}
          {Object.keys(piMcpServers).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(piMcpServers).map(([serverName, serverInfo]: [string, any]) => (
                <div key={serverName} className="rounded-lg border border-border bg-card/20">
                  <div className="border-b border-border px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">{serverName}</div>
                      <StatusPill tone="good">Active</StatusPill>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {serverInfo.command} {serverInfo.args?.join(" ")}
                    </div>
                  </div>
                  {serverInfo.tools && serverInfo.tools.length > 0 ? (
                    <div className="divide-y divide-border">
                      {serverInfo.tools.map((tool: any) => (
                        <div key={tool.name} className="flex items-start justify-between gap-4 px-3 py-2.5">
                          <div className="flex flex-col gap-1 min-w-0 flex-1 sm:grid sm:grid-cols-[200px_1fr] sm:gap-4 sm:items-start">
                            <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground self-start" title={tool.name}>
                              {tool.name}
                            </code>
                            <div className="text-xs leading-relaxed text-muted-foreground">
                              {tool.description}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shrink-0">
                            Enabled
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-xs text-muted-foreground">
                      No tools exposed by this server.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !piMcpLoading ? (
            <div className="rounded-lg border border-border bg-card/20 px-3 py-3 text-sm text-muted-foreground">
              No active MCP servers found in Pi Agent cache configuration.
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  if (defaultProvider && defaultProvider !== "claude" && defaultProvider !== "codex") {
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-6 py-5">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">MCP Not Supported</div>
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {defaultProvider === "antigravity"
                ? "Antigravity Agent không hỗ trợ cấu hình MCP servers trên Kanna. Nó sử dụng bộ công cụ tích hợp sẵn của nó."
                : `${defaultProvider} Agent không hỗ trợ cấu hình MCP servers trên Kanna.`}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isMcpCapabilityEnabled = config.capabilities?.mcp !== false
  const isWorkflowCapabilityEnabled = config.capabilities?.workflow !== false
  const isServerEffectivelyEnabled = isMcpCapabilityEnabled && isWorkflowCapabilityEnabled
  const toolNames = KANNA_MCP_TOOLS.map((tool) => tool.name)
  const enabledToolsCount = isServerEffectivelyEnabled
    ? toolNames.filter((toolName) => config.tools?.["kanna-workflow"]?.[toolName] !== false).length
    : 0
  const disabledToolsCount = toolNames.length - enabledToolsCount
  const tokenBloat = enabledToolsCount * 150
  const tokenSeverity = tokenBloat > 3000 ? "high" : tokenBloat > 1200 ? "medium" : "low"
  const severityText = tokenSeverity === "high" ? "High Context Bloat" : tokenSeverity === "medium" ? "Moderate Context Bloat" : "Optimal Context Usage"
  const severityColor = tokenSeverity === "high" ? "text-red-500 bg-red-500/10 border-red-500/20" : tokenSeverity === "medium" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"

  return (
    <div className="border-b border-border">
      {/* Telemetry/Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground font-sans">Total MCP Tools</span>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{toolNames.length}</span>
            <span className="text-xs text-muted-foreground font-sans">kanna-workflow tools</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground font-sans">Status Distribution</span>
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="h-2 w-2 rounded-full bg-muted" />
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-sans">Enabled</span>
              <span className="font-semibold text-emerald-500">{enabledToolsCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-sans">Disabled</span>
              <span className="font-semibold text-muted-foreground">{disabledToolsCount}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground font-sans">Est. Token Bloat</span>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">~{tokenBloat}</span>
              <span className="text-[10px] text-muted-foreground font-sans">tokens</span>
            </div>
            <span className={cn("inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border font-sans", severityColor)}>
              {severityText}
            </span>
          </div>
        </div>
      </div>

      <SettingsRow
        title="Local MCP Server"
        description="Kanna exposes workflow operations through a local stdio MCP server for MCP-capable agents and editors."
        bordered={false}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <StatusPill tone={servers.length > 0 ? "good" : "neutral"}>{servers.length > 0 ? "Configured" : "Not Configured"}</StatusPill>
          {servers.some(([name]) => name === "kanna-workflow") ? <CodePill>kanna-workflow</CodePill> : null}
        </div>
      </SettingsRow>

      <SettingsRow
        title="Project Config"
        description={`Manage the project-level MCP config${activeProject ? ` for ${activeProject.title}` : ""}.`}
      >
        <div className="flex items-center gap-2">
          <CodePill>.mcp.json</CodePill>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadConfig()} disabled={loading || !projectId}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </SettingsRow>

      <SettingsRow
        title="Servers"
        description="Add or remove MCP servers written to the active project's config file."
        alignStart
      >
        <div className="flex w-full max-w-[620px] flex-col gap-3">
          {mcpError ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {mcpError}
            </div>
          ) : null}

          {servers.length > 0 ? (
            <div className="space-y-2">
              {servers.map(([name, server]) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/30 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      {server.command}{server.args?.length ? ` ${server.args.join(" ")}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveServer(name)}
                    disabled={savingServerName === name}
                    title="Remove MCP server"
                    aria-label={`Remove MCP server ${name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  >
                    {savingServerName === name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card/20 px-3 py-3 text-sm text-muted-foreground">
              No MCP servers configured for this project.
            </div>
          )}

          <div className="grid gap-2 rounded-lg border border-border bg-card/20 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="server-name" className="font-mono" />
            <Input value={serverCommand} onChange={(event) => setServerCommand(event.target.value)} placeholder="command" className="font-mono" />
            <Input value={serverArgs} onChange={(event) => setServerArgs(event.target.value)} placeholder="args" className="font-mono" />
            <Button type="button" size="sm" onClick={() => void handleAddServer()} disabled={!projectId || savingServerName !== null}>
              {savingServerName === serverName.trim() ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add
            </Button>
          </div>
        </div>
      </SettingsRow>

      <SettingsRow
        title="Capabilities"
        description="Project-scoped agent surfaces. Disabled surfaces are hidden from supported agents on their next session."
        alignStart
      >
        <div className="flex w-full max-w-[720px] flex-col rounded-lg border border-border bg-card/20">
          {PROJECT_CAPABILITIES.map((capability) => {
            const isEnabled = config.capabilities?.[capability.id] !== false
            return (
              <div key={capability.id} className={cn(
                "flex items-center justify-between gap-4 border-b border-border px-3 py-3 last:border-b-0",
                !isEnabled && "bg-muted/20"
              )}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{capability.label}</span>
                    <StatusPill tone={isEnabled ? "good" : "neutral"}>{isEnabled ? "Enabled" : "Disabled"}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{capability.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleCapability(capability.id)}
                  disabled={savingServerName !== null}
                  title={isEnabled ? `Disable ${capability.label}` : `Enable ${capability.label}`}
                  aria-label={`${isEnabled ? "Disable" : "Enable"} ${capability.label}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {isEnabled ? (
                    <ToggleRight className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-muted-foreground/60" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </SettingsRow>

      <SettingsRow
        title="Tools"
        description="Tools are grouped by the MCP server that exposes them."
        alignStart
      >
        <div className="flex w-full max-w-[720px] flex-col gap-3">
          {servers.length > 0 ? (
            servers.map(([name, server]) => {
              const isKannaWorkflow = name === "kanna-workflow"
              const isMcpCapabilityEnabled = config.capabilities?.mcp !== false
              const isWorkflowCapabilityEnabled = config.capabilities?.workflow !== false
              const isServerEffectivelyEnabled = isMcpCapabilityEnabled && (!isKannaWorkflow || isWorkflowCapabilityEnabled)
              const toolNames = isKannaWorkflow ? KANNA_MCP_TOOLS.map((tool) => tool.name) : []
              const enabledCount = isServerEffectivelyEnabled
                ? toolNames.filter((toolName) => config.tools?.[name]?.[toolName] !== false).length
                : 0
              const disabledCount = toolNames.length - enabledCount
              return (
                <div key={name} className="rounded-lg border border-border bg-card/20">
                  <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-foreground">{name}</div>
                        <StatusPill tone={isKannaWorkflow ? "good" : "neutral"}>
                          {isKannaWorkflow ? `${enabledCount}/${toolNames.length} enabled` : "External"}
                        </StatusPill>
                        {!isServerEffectivelyEnabled ? <StatusPill tone="neutral">Capability off</StatusPill> : null}
                        {disabledCount > 0 ? <StatusPill tone="neutral">{disabledCount} disabled</StatusPill> : null}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {server.command}{server.args?.length ? ` ${server.args.join(" ")}` : ""}
                      </div>
                    </div>
                    {isKannaWorkflow ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => void handleSetServerTools(name, toolNames, false)}
                          disabled={savingServerName !== null || disabledCount === toolNames.length || !isServerEffectivelyEnabled}
                        >
                          Disable all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={() => void handleSetServerTools(name, toolNames, true)}
                          disabled={savingServerName !== null || enabledCount === toolNames.length || !isServerEffectivelyEnabled}
                        >
                          Enable all
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {isKannaWorkflow ? (
                    <div className="divide-y divide-border">
                      {KANNA_MCP_TOOLS.map((tool) => {
                        const isEnabled = isServerEffectivelyEnabled && config.tools?.[name]?.[tool.name] !== false
                        return (
                          <div key={tool.name} className={cn(
                            "flex items-center justify-between gap-4 px-3 py-2.5 transition-colors",
                            !isEnabled && "bg-muted/20"
                          )}>
                            <div className="flex flex-col gap-1 min-w-0 flex-1 sm:grid sm:grid-cols-[200px_1fr] sm:gap-4 sm:items-start">
                              <div className="flex items-center gap-2 self-start min-w-0">
                                <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground" title={tool.name}>
                                  {tool.name}
                                </code>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0",
                                  isEnabled 
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" 
                                    : "border-muted/40 bg-muted/20 text-muted-foreground"
                                )}>
                                  {isEnabled ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                              <div className="text-xs leading-relaxed text-muted-foreground">
                                {tool.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleToggleTool(name, tool.name)}
                              disabled={savingServerName !== null || !isServerEffectivelyEnabled}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                              title={isEnabled ? "Disable tool" : "Enable tool"}
                              aria-label={`${isEnabled ? "Disable" : "Enable"} ${tool.name}`}
                            >
                              {isEnabled ? (
                                <ToggleRight className="h-6 w-6 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-muted-foreground/60" />
                              )}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                      Tool names and descriptions are discovered by the MCP host when it connects to this server.
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="rounded-lg border border-border bg-card/20 px-3 py-3 text-sm text-muted-foreground">
              Configure a server to see its tools here.
            </div>
          )}
        </div>
      </SettingsRow>
    </div>
  )
}

function SettingsRow({
  title,
  description,
  children,
  bordered = true,
  alignStart = false,
}: {
  title: string
  description: ReactNode
  children: ReactNode
  bordered?: boolean
  alignStart?: boolean
}) {
  return (
    <div className={bordered ? "border-t border-border" : undefined}>
      <div
        className={cn(
          "flex flex-col gap-4 py-5 md:flex-row md:justify-between md:gap-8",
          alignStart ? "md:items-start" : "md:items-center"
        )}
      >
        <div className="min-w-0 max-w-xl">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="mt-1 text-[13px] text-muted-foreground">{description}</div>
        </div>
        <div className="flex items-center justify-start md:shrink-0 md:justify-end">{children}</div>
      </div>
    </div>
  )
}

interface AgentConfigEditorProps {
  agent: AgentProvider
  socket: any
}

function AgentConfigEditor({ agent, socket }: AgentConfigEditorProps) {
  const [content, setContent] = useState("")
  const [draft, setDraft] = useState("")
  const [hasBackup, setHasBackup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState("")

  const configFiles: Record<AgentProvider, { name: string; path: string; isJson: boolean }> = {
    pi: { name: "settings.json", path: "~/.pi/agent/settings.json", isJson: true },
    antigravity: { name: "mcp_config.json", path: "~/.gemini/config/mcp_config.json", isJson: true },
    claude: { name: ".claude.json", path: "~/.claude.json", isJson: true },
    codex: { name: "config.toml", path: "~/.codex/config.toml", isJson: false },
  }

  const fileInfo = configFiles[agent]

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    setSuccessMsg("")
    try {
      const result = await socket.command({
        type: "settings.readAgentConfig",
        agent,
      })
      setContent(result.content)
      setDraft(result.content)
      setHasBackup(result.hasBackup)
    } catch (err: any) {
      setError(err?.message || "Failed to load configuration.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [agent])

  const handleTextChange = (val: string) => {
    setDraft(val)
    setSuccessMsg("")
    if (fileInfo.isJson && val.trim()) {
      try {
        JSON.parse(val)
        setError(null)
      } catch (err: any) {
        setError(`Invalid JSON: ${err.message}`)
      }
    } else {
      setError(null)
    }
  }

  const handleSave = async () => {
    if (error) return
    setLoading(true)
    setError(null)
    setSuccessMsg("")
    try {
      await socket.command({
        type: "settings.writeAgentConfig",
        agent,
        content: draft,
      })
      setContent(draft)
      setSuccessMsg("Configuration saved successfully (backup created).")
      setHasBackup(true)
    } catch (err: any) {
      setError(err?.message || "Failed to save configuration.")
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!confirm("Are you sure you want to restore from the backup? This will overwrite the current configuration.")) {
      return
    }
    setLoading(true)
    setError(null)
    setSuccessMsg("")
    try {
      await socket.command({
        type: "settings.restoreAgentConfig",
        agent,
      })
      await loadConfig()
      setSuccessMsg("Configuration restored from backup successfully.")
    } catch (err: any) {
      setError(err?.message || "Failed to restore backup.")
    } finally {
      setLoading(false)
    }
  }

  const isModified = draft !== content
  const canSave = isModified && !error && !loading

  return (
    <div className="space-y-3 border-t border-border/30 pt-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-xs font-semibold text-foreground">Raw Configuration Editor</h5>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{fileInfo.path}</p>
        </div>
        <div className="flex gap-2">
          {hasBackup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRestore()}
              disabled={loading}
              className="text-[11px] h-7 px-2.5"
            >
              Restore from Backup
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="text-[11px] h-7 px-2.5"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={draft}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={loading}
          spellCheck={false}
          className="w-full h-48 font-mono text-xs p-3 rounded-lg border border-border bg-muted/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          placeholder={`// Paste or write ${fileInfo.name} content here...`}
        />
      </div>

      {error && (
        <div className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="text-xs font-medium text-green bg-green/10 border border-green/20 rounded-md p-2">
          {successMsg}
        </div>
      )}
    </div>
  )
}


export function SettingsPage() {
  const navigate = useNavigate()
  const { sectionId } = useParams<{ sectionId: string }>()
  const state = useOutletContext<KannaState>()
  const { theme, setTheme } = useTheme()
  const [changelogStatus, setChangelogStatus] = useState<ChangelogStatus>("idle")
  const [signingOut, setSigningOut] = useState(false)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [releases, setReleases] = useState<GithubRelease[]>([])
  const [changelogError, setChangelogError] = useState<string | null>(null)
  const selectedPage = resolveSettingsSectionId(sectionId) ?? "general"
  const isConnecting = state.connectionStatus === "connecting" || !state.localProjectsReady
  const machineName = state.localProjects?.machine.displayName ?? "Unavailable"
  const projectCount = state.localProjects?.projects.length ?? 0
  const appVersion = SDK_CLIENT_APP.split("/")[1] ?? "unknown"
  const scrollbackLines = useTerminalPreferencesStore((store) => store.scrollbackLines)
  const minColumnWidth = useTerminalPreferencesStore((store) => store.minColumnWidth)
  const editorPreset = useTerminalPreferencesStore((store) => store.editorPreset)
  const editorCommandTemplate = useTerminalPreferencesStore((store) => store.editorCommandTemplate)
  const setScrollbackLines = useTerminalPreferencesStore((store) => store.setScrollbackLines)
  const setMinColumnWidth = useTerminalPreferencesStore((store) => store.setMinColumnWidth)
  const setEditorPreset = useTerminalPreferencesStore((store) => store.setEditorPreset)
  const setEditorCommandTemplate = useTerminalPreferencesStore((store) => store.setEditorCommandTemplate)
  const chatSoundPreference = useChatSoundPreferencesStore((store) => store.chatSoundPreference)
  const chatSoundId = useChatSoundPreferencesStore((store) => store.chatSoundId)
  const setChatSoundPreference = useChatSoundPreferencesStore((store) => store.setChatSoundPreference)
  const setChatSoundId = useChatSoundPreferencesStore((store) => store.setChatSoundId)
  const keybindings = state.keybindings
  const appSettings = state.appSettings
  const llmProvider = state.llmProvider
  const defaultProvider = useChatPreferencesStore((store) => store.defaultProvider)
  const providerDefaults = useChatPreferencesStore((store) => store.providerDefaults)
  const setDefaultProvider = useChatPreferencesStore((store) => store.setDefaultProvider)
  const setProviderDefaultModel = useChatPreferencesStore((store) => store.setProviderDefaultModel)
  const setProviderDefaultModelOptions = useChatPreferencesStore((store) => store.setProviderDefaultModelOptions)
  const setProviderDefaultPlanMode = useChatPreferencesStore((store) => store.setProviderDefaultPlanMode)
  const resolvedKeybindings = useMemo(() => getResolvedKeybindings(keybindings), [keybindings])
  const keybindingsFilePathDisplay = resolvedKeybindings.filePathDisplay || getKeybindingsFilePathDisplay()
  const [scrollbackDraft, setScrollbackDraft] = useState(String(scrollbackLines))
  const [minColumnWidthDraft, setMinColumnWidthDraft] = useState(String(minColumnWidth))
  const [editorCommandDraft, setEditorCommandDraft] = useState(editorCommandTemplate)
  const [keybindingDrafts, setKeybindingDrafts] = useState<Record<string, string>>({})
  const [keybindingsError, setKeybindingsError] = useState<string | null>(null)
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null)
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false)
  const [llmProviderDraft, setLlmProviderDraft] = useState({
    provider: "openai" as LlmProviderKind,
    apiKey: "",
    model: "",
    baseUrl: "",
  })
  const [llmProviderError, setLlmProviderError] = useState<string | null>(null)
  const [llmValidationStatus, setLlmValidationStatus] = useState<"idle" | "valid" | "invalid">("idle")
  const [llmValidationError, setLlmValidationError] = useState<unknown | null>(null)
  const [llmValidationDialogOpen, setLlmValidationDialogOpen] = useState(false)
  const [isValidatingLlm, setIsValidatingLlm] = useState(false)
  const [showLlmApiKey, setShowLlmApiKey] = useState(false)
  const [piProviderCatalog, setPiProviderCatalog] = useState<ProviderCatalogEntry | null>(null)
  const [agentCliDetection, setAgentCliDetection] = useState<AgentCliDetectionSnapshot | null>(null)
  const [agentCliDetectionError, setAgentCliDetectionError] = useState<string | null>(null)
  const [customAgentDialogOpen, setCustomAgentDialogOpen] = useState(false)
  const [customAgentDisplayName, setCustomAgentDisplayName] = useState("")
  const [customAgentCommand, setCustomAgentCommand] = useState("")
  const [customAgentArgs, setCustomAgentArgs] = useState("")
  const [customAgentEnv, setCustomAgentEnv] = useState<CustomAgentEnvVar[]>([])
  const [customAgentAdvanced, setCustomAgentAdvanced] = useState(JSON.stringify(DEFAULT_CUSTOM_AGENT_ADVANCED, null, 2))
  const [customAgentError, setCustomAgentError] = useState<string | null>(null)
  const [customAgentTestResult, setCustomAgentTestResult] = useState<CustomAgentConnectionTestResult | null>(null)
  const [customAgentTesting, setCustomAgentTesting] = useState(false)
  const [openAgentAccordion, setOpenAgentAccordion] = useState<string | null>(null)
  const openExternalPath = async (pathStr: string) => {
    try {
      await state.socket.command({
        type: "system.openExternal",
        localPath: pathStr,
        action: "open_finder",
      })
    } catch (err) {
      console.error(err)
    }
  }
  const updateSnapshot = state.updateSnapshot
  const handleWriteAppSettings = state.handleWriteAppSettings
  const handleReadLlmProvider = state.handleReadLlmProvider
  const handleWriteLlmProvider = state.handleWriteLlmProvider
  const handleValidateLlmProvider = state.handleValidateLlmProvider

  useEffect(() => {
    if (defaultProvider) {
      setOpenAgentAccordion(defaultProvider === "antigravity" ? "last_used" : defaultProvider)
    } else {
      setOpenAgentAccordion("claude")
    }
  }, [defaultProvider])
  const settingsProviderCatalogs = useMemo(() => {
    const providers = piProviderCatalog
      ? PROVIDERS.map((provider) => provider.id === "pi" ? piProviderCatalog : provider)
      : PROVIDERS
    return providers
  }, [piProviderCatalog])
  const enabledSettingsProviderCatalogs = useMemo(() => settingsProviderCatalogs.filter((provider) => !provider.disabled), [settingsProviderCatalogs])
  const agentCliDetectionByProvider = useMemo(() => new Map(
    (agentCliDetection?.agents ?? []).map((agent) => [agent.provider, agent])
  ), [agentCliDetection])
  const updateStatusLabel = updateSnapshot?.status === "checking"
    ? "Checking for updates…"
    : updateSnapshot?.status === "updating"
      ? "Installing update…"
      : updateSnapshot?.status === "restart_pending"
        ? "Restarting Kanna…"
        : updateSnapshot?.status === "available"
          ? `Update available${updateSnapshot.latestVersion ? `: ${updateSnapshot.latestVersion}` : ""}`
          : updateSnapshot?.status === "up_to_date"
            ? "Up to date"
            : updateSnapshot?.status === "error"
              ? "Update check failed"
              : "Not checked yet"

  useEffect(() => {
    setScrollbackDraft(String(scrollbackLines))
  }, [scrollbackLines])

  useEffect(() => {
    setMinColumnWidthDraft(String(minColumnWidth))
  }, [minColumnWidth])

  useEffect(() => {
    setEditorCommandDraft(editorCommandTemplate)
  }, [editorCommandTemplate])

  useEffect(() => {
    setKeybindingDrafts(Object.fromEntries(
      KEYBINDING_ACTIONS.map((action) => [
        action,
        formatKeybindingInput(resolvedKeybindings.bindings[action]),
      ])
    ))
  }, [resolvedKeybindings])

  useEffect(() => {
    if (!llmProvider) return
    setLlmProviderDraft({
      provider: llmProvider.provider,
      apiKey: llmProvider.apiKey,
      model: llmProvider.model,
      baseUrl: llmProvider.baseUrl,
    })
  }, [llmProvider])

  useEffect(() => {
    setLlmValidationStatus("idle")
    setLlmValidationError(null)
  }, [llmProviderDraft.provider, llmProviderDraft.apiKey, llmProviderDraft.model, llmProviderDraft.baseUrl])

  useEffect(() => {
    if (!sectionId) return
    if (resolveSettingsSectionId(sectionId)) return
    navigate("/settings/general", { replace: true })
  }, [navigate, sectionId])

  useEffect(() => {
    let cancelled = false

    void fetch("/auth/status", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) return { enabled: false }
        return await response.json() as { enabled?: boolean }
      })
      .then((payload) => {
        if (cancelled) return
        setAuthEnabled(payload.enabled === true)
      })
      .catch(() => {
        if (cancelled) return
        setAuthEnabled(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedPage !== "llm" || isConnecting) return
    void handleReadLlmProvider()
  }, [handleReadLlmProvider, isConnecting, selectedPage])

  useEffect(() => {
    if (selectedPage !== "agents" || isConnecting) return
    let cancelled = false
    void state.socket.command<ProviderCatalogEntry>({ type: "settings.readPiProviderCatalog" })
      .then((catalog) => {
        if (!cancelled) setPiProviderCatalog(catalog)
      })
      .catch(() => {
        if (!cancelled) setPiProviderCatalog(null)
      })
    return () => {
      cancelled = true
    }
  }, [isConnecting, selectedPage, state.socket])

  useEffect(() => {
    if (selectedPage !== "agents" || isConnecting) return
    let cancelled = false
    setAgentCliDetectionError(null)
    void state.socket.command<AgentCliDetectionSnapshot>({ type: "settings.detectAgentClis" })
      .then((snapshot) => {
        if (!cancelled) setAgentCliDetection(snapshot)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setAgentCliDetection(null)
        setAgentCliDetectionError(error instanceof Error ? error.message : "Unable to detect local agent CLIs.")
      })
    return () => {
      cancelled = true
    }
  }, [isConnecting, selectedPage, state.socket])

  useEffect(() => {
    if (selectedPage !== "changelog" || isConnecting) return

    let cancelled = false
    setChangelogStatus("loading")
    setChangelogError(null)

    void loadChangelog()
      .then((nextReleases) => {
        if (cancelled) return
        setReleases(nextReleases)
        setChangelogStatus("success")
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setChangelogError(error instanceof Error ? error.message : "Unable to load changelog.")
        setChangelogStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [isConnecting, selectedPage])

  function commitScrollback() {
    const nextValue = Number(scrollbackDraft)
    if (!Number.isFinite(nextValue)) {
      setScrollbackDraft(String(scrollbackLines))
      return
    }
    setScrollbackLines(nextValue)
    void handleWriteAppSettings({ terminal: { scrollbackLines: nextValue } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save terminal settings.")
    })
  }

  function commitMinColumnWidth() {
    const nextValue = Number(minColumnWidthDraft)
    if (!Number.isFinite(nextValue)) {
      setMinColumnWidthDraft(String(minColumnWidth))
      return
    }
    setMinColumnWidth(nextValue)
    void handleWriteAppSettings({ terminal: { minColumnWidth: nextValue } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save terminal settings.")
    })
  }

  function handleNumberInputKeyDown(event: KeyboardEvent<HTMLInputElement>, commit: () => void) {
    if (event.key !== "Enter") return
    commit()
    event.currentTarget.blur()
  }

  function handleTextInputKeyDown(event: KeyboardEvent<HTMLInputElement>, commit: () => void) {
    if (event.key !== "Enter") return
    commit()
    event.currentTarget.blur()
  }

  function commitEditorCommand() {
    setEditorCommandTemplate(editorCommandDraft)
    void handleWriteAppSettings({ editor: { commandTemplate: editorCommandDraft } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save editor settings.")
    })
  }

  function handleThemeChange(nextTheme: typeof theme) {
    setTheme(nextTheme)
    void handleWriteAppSettings({ theme: nextTheme }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save theme settings.")
    })
  }

  function handleEditorPresetChange(nextPreset: EditorPreset) {
    setEditorPreset(nextPreset)
    const commandTemplate = nextPreset === "custom" ? editorCommandTemplate : getDefaultEditorCommandTemplate(nextPreset)
    void handleWriteAppSettings({
      editor: {
        preset: nextPreset,
        commandTemplate,
      },
    }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save editor settings.")
    })
  }

  function handleChatSoundPreferenceChange(nextValue: ChatSoundPreference) {
    if (!shouldPreviewChatSoundChange(chatSoundPreference, nextValue)) {
      return
    }

    setChatSoundPreference(nextValue)
    void handleWriteAppSettings({ chatSoundPreference: nextValue }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save chat sound settings.")
    })
    void playChatNotificationSound(chatSoundId, 1).catch(() => undefined)
  }

  function handleChatSoundIdChange(nextValue: ChatSoundId) {
    if (!shouldPreviewChatSoundChange(chatSoundId, nextValue)) {
      return
    }

    setChatSoundId(nextValue)
    void handleWriteAppSettings({ chatSoundId: nextValue }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save chat sound settings.")
    })
    void playChatNotificationSound(nextValue, 1).catch(() => undefined)
  }

  async function handleAnalyticsPreferenceChange(nextValue: "enabled" | "disabled") {
    try {
      setAppSettingsError(null)
      await handleWriteAppSettings({ analyticsEnabled: nextValue === "enabled" })
    } catch (error) {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save analytics settings.")
    }
  }

  function handleDefaultProviderChange(nextValue: "last_used" | AgentProvider) {
    const provider = nextValue === "antigravity" ? "last_used" : nextValue
    setDefaultProvider(provider)
    void handleWriteAppSettings({ defaultProvider: provider }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save provider settings.")
    })
  }

  function handleProviderDefaultModelChange(provider: AgentProvider, model: string) {
    setProviderDefaultModel(provider, model)
    void handleWriteAppSettings({ providerDefaults: { [provider]: { model } } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save provider settings.")
    })
  }

  function handleProviderDefaultModelOptionsChange(
    provider: AgentProvider,
    modelOptions: Partial<typeof providerDefaults[typeof provider]["modelOptions"]>
  ) {
    setProviderDefaultModelOptions(provider, modelOptions)
    void handleWriteAppSettings({ providerDefaults: { [provider]: { modelOptions } } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save provider settings.")
    })
  }

  function handleProviderDefaultPlanModeChange(provider: AgentProvider, planMode: boolean) {
    setProviderDefaultPlanMode(provider, planMode)
    void handleWriteAppSettings({ providerDefaults: { [provider]: { planMode } } }).catch((error) => {
      setAppSettingsError(error instanceof Error ? error.message : "Unable to save provider settings.")
    })
  }

  function resetCustomAgentDialog() {
    setCustomAgentDisplayName("")
    setCustomAgentCommand("")
    setCustomAgentArgs("")
    setCustomAgentEnv([])
    setCustomAgentAdvanced(JSON.stringify(DEFAULT_CUSTOM_AGENT_ADVANCED, null, 2))
    setCustomAgentError(null)
    setCustomAgentTestResult(null)
    setCustomAgentTesting(false)
  }

  function updateCustomAgentEnv(index: number, patch: Partial<CustomAgentEnvVar>) {
    setCustomAgentEnv((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function handleTestCustomAgent() {
    try {
      setCustomAgentTesting(true)
      setCustomAgentError(null)
      const result = await state.socket.command<CustomAgentConnectionTestResult>({
        type: "settings.testCustomAgent",
        agent: {
          command: customAgentCommand,
          args: customAgentArgs,
          env: customAgentEnv.filter((item) => item.key.trim()),
        },
      })
      setCustomAgentTestResult(result)
    } catch (error) {
      setCustomAgentTestResult(null)
      setCustomAgentError(error instanceof Error ? error.message : "Unable to test custom agent.")
    } finally {
      setCustomAgentTesting(false)
    }
  }

  async function handleSaveCustomAgent() {
    const displayName = customAgentDisplayName.trim()
    const command = customAgentCommand.trim()
    if (!displayName || !command) {
      setCustomAgentError("Display name and command are required.")
      return
    }

    let advanced: CustomAgentConfig["advanced"]
    try {
      const parsed = JSON.parse(customAgentAdvanced) as CustomAgentConfig["advanced"]
      advanced = {
        ...DEFAULT_CUSTOM_AGENT_ADVANCED,
        ...parsed,
        behavior_policy: {
          ...DEFAULT_CUSTOM_AGENT_ADVANCED.behavior_policy,
          ...(parsed?.behavior_policy ?? {}),
        },
      }
    } catch {
      setCustomAgentError("Advanced JSON is invalid.")
      return
    }

    const now = new Date().toISOString()
    const nextAgent: CustomAgentConfig = {
      id: createCustomAgentId(displayName),
      displayName,
      command,
      args: customAgentArgs.trim(),
      env: customAgentEnv.filter((item) => item.key.trim()).map((item) => ({ key: item.key.trim(), value: item.value })),
      advanced,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }

    try {
      setCustomAgentError(null)
      await handleWriteAppSettings({
        customAgents: [...(appSettings?.customAgents ?? []), nextAgent],
      })
      setCustomAgentDialogOpen(false)
      resetCustomAgentDialog()
    } catch (error) {
      setCustomAgentError(error instanceof Error ? error.message : "Unable to save custom agent.")
    }
  }

  async function commitKeybindings() {
    try {
      setKeybindingsError(null)
      await state.socket.command({
        type: "settings.writeKeybindings",
        bindings: buildKeybindingPayload(keybindingDrafts),
      })
    } catch (error) {
      setKeybindingsError(error instanceof Error ? error.message : "Unable to save keybindings.")
    }
  }

  async function restoreDefaultKeybinding(action: keyof typeof KEYBINDING_ACTION_LABELS) {
    const nextDrafts = {
      ...keybindingDrafts,
      [action]: formatKeybindingInput(DEFAULT_KEYBINDINGS[action]),
    }
    setKeybindingDrafts(nextDrafts)

    try {
      setKeybindingsError(null)
      await state.socket.command({
        type: "settings.writeKeybindings",
        bindings: buildKeybindingPayload(nextDrafts),
      })
    } catch (error) {
      setKeybindingsError(error instanceof Error ? error.message : "Unable to save keybindings.")
    }
  }

  async function commitLlmProvider(nextValue = llmProviderDraft) {
    try {
      setLlmProviderError(null)
      setIsValidatingLlm(true)
      await handleWriteLlmProvider(nextValue)
      const validation = await handleValidateLlmProvider(nextValue)
      setLlmValidationStatus(validation.ok ? "valid" : "invalid")
      setLlmValidationError(validation.error)
    } catch (error) {
      const fallbackError = error instanceof Error
        ? { name: error.name, message: error.message }
        : error
      setLlmValidationStatus("invalid")
      setLlmValidationError(fallbackError)
      setLlmProviderError(error instanceof Error ? error.message : "Unable to save quick response provider settings.")
    } finally {
      setIsValidatingLlm(false)
    }
  }

  function handleLlmProviderSelection(nextProvider: LlmProviderKind) {
    const nextDraft = {
      ...llmProviderDraft,
      provider: nextProvider,
      model: nextProvider === "openai"
        ? DEFAULT_OPENAI_SDK_MODEL
        : nextProvider === "openrouter"
          ? DEFAULT_OPENROUTER_SDK_MODEL
          : llmProviderDraft.model,
      baseUrl: nextProvider === "custom" ? llmProviderDraft.baseUrl : "",
    }
    setLlmProviderDraft(nextDraft)
    void commitLlmProvider(nextDraft)
  }

  function retryChangelog() {
    changelogCache = null
    setChangelogStatus("loading")
    setChangelogError(null)

    void loadChangelog({ force: true })
      .then((nextReleases) => {
        setReleases(nextReleases)
        setChangelogStatus("success")
      })
      .catch((error: unknown) => {
        setChangelogError(error instanceof Error ? error.message : "Unable to load changelog.")
        setChangelogStatus("error")
      })
  }

  const customEditorPreview = editorCommandDraft
    .replaceAll("{path}", "/Users/jake/Projects/kanna/src/client/app/App.tsx")
    .replaceAll("{line}", "12")
    .replaceAll("{column}", "1")
  const analyticsDisclosureEvents = ANALYTICS_STATIC_EVENT_NAMES
  const analyticsSettingValue = appSettings?.analyticsEnabled === false ? "disabled" : "enabled"
  const selectedSection = sidebarItems.find((item) => item.id === selectedPage) ?? sidebarItems[0]
  const selectedSectionSubtitle =
    selectedPage === "keybindings"
      ? getKeybindingsSubtitle(keybindingsFilePathDisplay)
      : selectedSection.subtitle
  const showFooter = !isConnecting
  const llmValidationErrorText = llmValidationError ? JSON.stringify(llmValidationError, null, 2) : ""
  const llmValidationDescription = (
    <>
      <span>
        Use an OpenAI-compatible API for title and commit message generation before Claude and Codex. Stored in {llmProvider?.filePathDisplay ?? "the active llm-provider.json file"}.
      </span>
      <span
        className={cn(
          "mt-2 block text-sm font-medium",
          llmValidationStatus === "valid"
            ? "text-emerald-600 dark:text-emerald-400"
            : llmValidationStatus === "invalid"
              ? "text-destructive"
              : "hidden"
        )}
      >
        {llmValidationStatus === "valid" ? (
          "Credentials valid & saved"
        ) : llmValidationStatus === "invalid" ? (
          <>
            <span>Credentials invalid.</span>
            {llmValidationError ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setLlmValidationDialogOpen(true)}
                  className="underline underline-offset-2"
                >
                  See error
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </span>
    </>
  )

  async function handleSidebarSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await state.handleSignOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="relative flex h-full flex-1 min-w-0 bg-background">
      <div className="flex min-w-0 flex-1">
        <aside className={`hidden w-[200px] shrink-0 md:block ${showFooter ? "pb-[89px]" : ""}`}>
          <div className="flex flex-col gap-1 px-4 py-6">
            <div className="px-3 pb-5 text-[22px] font-extrabold tracking-[-0.5px] text-foreground">
              Settings
            </div>
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(`/settings/${item.id}`)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
                  item.id === selectedPage
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              </button>
            ))}
            {authEnabled ? (
              <button
                type="button"
                onClick={() => {
                  void handleSidebarSignOut()
                }}
                disabled={signingOut}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                </div>
              </button>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="border-b border-border py-2 md:hidden">
            <div className="overflow-x-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max items-center gap-2">
                <div className=" sticky left-0 bg-gradient-to-r from-background via-background/80 to-transparent px-2  py-1">
                <button
                  type="button"
                  onClick={state.openSidebar}
                  className="flex shrink-0 items-center p-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  aria-label="Open sidebar"
                  title="Open sidebar"
                >
                  <Menu className="h-4 w-4 shrink-0" />
                </button>
                </div>
                {sidebarItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(`/settings/${item.id}`)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                      item.id === selectedPage
                        ? "border-transparent bg-muted font-medium text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                ))}
                {authEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSidebarSignOut()
                    }}
                    disabled={signingOut}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                      "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{signingOut ? "Signing out..." : "Sign out"}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="w-full px-4 pb-32 pt-8 md:px-6 md:pt-16">
            {isConnecting ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading machine settings…</span>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl">
                <div className="pb-6">
                  <div className="flex items-center justify-between gap-4 min-h-[34px]">
                    <div className="text-lg font-semibold tracking-[-0.2px] text-foreground">
                      {selectedSection.label}
                    </div>
                    {selectedPage === "general" ? (
                      <SettingsHeaderButton
                        variant="outline"
                        onClick={() => navigate("/settings/changelog")}
                      >
                        Check for updates
                      </SettingsHeaderButton>
                    ) : null}
                    {selectedPage === "keybindings" ? (
                      <SettingsHeaderButton
                        onClick={() => {
                          void state.handleOpenExternalPath("open_editor", keybindingsFilePathDisplay)
                        }}
                        icon={<Code className="h-4 w-4" />}
                      >
                        Open in {state.editorLabel}
                      </SettingsHeaderButton>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedSectionSubtitle}
                  </div>
                </div>

                {selectedPage === "general" ? (
                  <>
                    {appSettingsError ? (
                      <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {appSettingsError}
                      </div>
                    ) : null}
                    <div className="border-b border-border">
                      <SettingsRow
                        title="Application Update"
                        description={(
                          <>
                            <span>{updateStatusLabel}.</span>
                            {updateSnapshot?.lastCheckedAt ? (
                              <span> Last checked {new Intl.DateTimeFormat(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              }).format(updateSnapshot.lastCheckedAt)}.</span>
                            ) : null}
                            {updateSnapshot?.error ? (
                              <span> {updateSnapshot.error}</span>
                            ) : null}
                          </>
                        )}
                        bordered={false}
                      >
                        <div className="text-right text-sm text-foreground">
                          <div>Current: {updateSnapshot?.currentVersion ?? appVersion}</div>
                          <div className="text-xs text-muted-foreground">
                            Latest: {updateSnapshot?.latestVersion ?? "Unknown"}
                          </div>
                        </div>
                      </SettingsRow>

                      <SettingsRow
                        title="Theme"
                        description="Choose between light, dark, or system appearance"
                      >
                        <SegmentedControl
                          value={theme}
                          onValueChange={handleThemeChange}
                          options={themeOptions}
                          size="sm"
                        />
                      </SettingsRow>

                      <SettingsRow
                        title="Chat Sounds"
                        description="Play a pop when a chat starts waiting on you or the unread chat count increases"
                      >
                        <Select
                          value={chatSoundPreference}
                          onValueChange={(value) => handleChatSoundPreferenceChange(value as ChatSoundPreference)}
                        >
                          <SelectTrigger className="min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {chatSoundPreferenceOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </SettingsRow>

                      <SettingsRow
                        title="Chat Sound"
                        description="The bundled sound used for chat notification playback and previews"
                      >
                        <Select
                          value={chatSoundId}
                          onValueChange={(value) => handleChatSoundIdChange(value as ChatSoundId)}
                        >
                          <SelectTrigger className="min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {CHAT_SOUND_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </SettingsRow>

                      <SettingsRow
                        title="Default Editor"
                        description="Used when opening transcript links or files from the git diff menu"
                        alignStart
                      >
                        <Select
                          value={editorPreset}
                          onValueChange={(value) => handleEditorPresetChange(value as EditorPreset)}
                        >
                          <SelectTrigger className="min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {EDITOR_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <span className="flex items-center gap-2">
                                    <EditorIcon preset={option.value} className="h-4 w-4 shrink-0" />
                                    <span>{option.label}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </SettingsRow>

                      {editorPreset === "custom" ? (
                        <div className="border-t border-border">
                          <div className="flex justify-between gap-8 py-5 pl-6">
                            <div className="min-w-0 max-w-xl">
                              <div className="text-sm font-medium text-foreground">Command Template</div>
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                Include {"{path}"} and optionally {"{line}"} and {"{column}"} in your command.
                              </div>
                            </div>
                            <div className="flex min-w-0 max-w-[420px] flex-1 flex-col items-stretch gap-2">
                              <Input
                                type="text"
                                value={editorCommandDraft}
                                onChange={(event) => setEditorCommandDraft(event.target.value)}
                                onBlur={commitEditorCommand}
                                onKeyDown={(event) => handleTextInputKeyDown(event, commitEditorCommand)}
                                className="font-mono"
                              />
                              <div className="text-xs text-muted-foreground">
                                Preview: <span className="font-mono">{customEditorPreview}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <SettingsRow
                        title="Terminal Scrollback"
                        description="Lines retained for embedded terminal history"
                      >
                        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                          <Input
                            type="number"
                            min={MIN_TERMINAL_SCROLLBACK}
                            max={MAX_TERMINAL_SCROLLBACK}
                            step={100}
                            value={scrollbackDraft}
                            onChange={(event) => setScrollbackDraft(event.target.value)}
                            onBlur={commitScrollback}
                            onKeyDown={(event) => handleNumberInputKeyDown(event, commitScrollback)}
                            className="hide-number-steppers w-full text-left font-mono md:w-28 md:text-right"
                          />
                          <div className="text-left text-xs text-muted-foreground md:text-right">
                            {MIN_TERMINAL_SCROLLBACK}-{MAX_TERMINAL_SCROLLBACK} lines
                            {scrollbackLines === DEFAULT_TERMINAL_SCROLLBACK ? " (default)" : ""}
                          </div>
                        </div>
                      </SettingsRow>

                      <SettingsRow
                        title="Terminal Min Column Width"
                        description="Minimum width for each terminal pane"
                      >
                        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:items-end">
                          <Input
                            type="number"
                            min={MIN_TERMINAL_MIN_COLUMN_WIDTH}
                            max={MAX_TERMINAL_MIN_COLUMN_WIDTH}
                            step={10}
                            value={minColumnWidthDraft}
                            onChange={(event) => setMinColumnWidthDraft(event.target.value)}
                            onBlur={commitMinColumnWidth}
                            onKeyDown={(event) => handleNumberInputKeyDown(event, commitMinColumnWidth)}
                            className="hide-number-steppers w-full text-left font-mono md:w-28 md:text-right"
                          />
                          <div className="text-left text-xs text-muted-foreground md:text-right">
                            {MIN_TERMINAL_MIN_COLUMN_WIDTH}-{MAX_TERMINAL_MIN_COLUMN_WIDTH} px
                            {minColumnWidth === DEFAULT_TERMINAL_MIN_COLUMN_WIDTH ? " (default)" : ""}
                          </div>
                        </div>
                      </SettingsRow>

                      <SettingsRow
                        title="Anonymous Analytics"
                        description={(
                          <>
                            <span>
                              Help improve Kanna with anonymous product analytics. Kanna sends tracked event names plus a small set of event properties like current version, environment, update version info, and launch flags. No message content, prompts, file paths, or provider credentials are sent.
                            </span>
                            <span className="mt-1 block">
                              Stored in {appSettings?.filePathDisplay ?? "~/.kanna/data/settings.json"}.
                              {" "}
                              <button
                                type="button"
                                onClick={() => setAnalyticsDialogOpen(true)}
                                className="underline underline-offset-2 text-foreground hover:text-foreground/80"
                              >
                                View tracked events
                              </button>
                            </span>
                            {appSettings?.warning ? (
                              <span className="mt-1 block">{appSettings.warning}</span>
                            ) : null}
                          </>
                        )}
                      >
                        <SegmentedControl
                          value={analyticsSettingValue}
                          onValueChange={(value) => {
                            void handleAnalyticsPreferenceChange(value)
                          }}
                          options={analyticsOptions}
                          size="sm"
                        />
                      </SettingsRow>
                    </div>
                  </>
                ) : selectedPage === "agents" ? (
                  <div className="border-b border-border space-y-6">
                    <SettingsRow
                      title="Default Provider"
                      description="The default harness used for new chats before a provider is locked by an existing session."
                      bordered={false}
                    >
                      <Select
                        value={defaultProvider === "antigravity" ? "last_used" : defaultProvider}
                        onValueChange={(value) => handleDefaultProviderChange(value as "last_used" | AgentProvider)}
                      >
                        <SelectTrigger className="min-w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="last_used">
                              Last Used
                            </SelectItem>
                            {enabledSettingsProviderCatalogs.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {provider.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </SettingsRow>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-foreground">Agent Configurations</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-xl border border-border p-4 bg-muted/5">
                        {/* Cột trái: Danh sách Agent */}
                        <div className="flex flex-col gap-2 md:col-span-1 border-b md:border-b-0 md:border-r border-border/50 pb-4 md:pb-0 md:pr-4">
                          {[
                            { id: "claude", label: "Claude Code", tools: ["read_file", "write_file", "run_command", "grep_search"] },
                            { id: "codex", label: "Codex", tools: ["web_search", "text_summarize"] },
                            { id: "antigravity", label: "Antigravity", tools: ["code_analysis", "run_experiment"] },
                            { id: "pi", label: "Pi Agent", tools: ["list_skills", "list_mcp_servers"] }
                          ].map((agent) => {
                            const isSelected = openAgentAccordion === agent.id
                            const isDefault = defaultProvider === agent.id
                            
                            return (
                              <button
                                key={agent.id}
                                type="button"
                                onClick={() => setOpenAgentAccordion(agent.id)}
                                className={`w-full flex flex-col items-start gap-1.5 p-3 rounded-lg text-left transition-colors border ${
                                  isSelected 
                                    ? "bg-primary/5 border-primary/20 text-primary-foreground" 
                                    : "hover:bg-muted/10 border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-foreground">{agent.label}</span>
                                  {isDefault && <StatusPill tone="good">Default</StatusPill>}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {agent.tools.map((t) => (
                                    <code key={t} className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                                      {t}
                                    </code>
                                  ))}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        <div className="md:col-span-2 min-h-[180px] flex flex-col justify-start">
                          {openAgentAccordion === "claude" && (
                            <div className="space-y-5 text-sm">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <h4 className="text-sm font-semibold text-foreground">Claude Code Configuration</h4>
                                <AgentCliDetectionPill agent={agentCliDetectionByProvider.get("claude")} />
                              </div>

                              <div className="text-muted-foreground text-xs leading-relaxed">
                                Claude Code là agent CLI chạy trực tiếp trong terminal của bạn. Kanna tích hợp Claude Code để cung cấp giao diện quản lý tệp tin trực quan, theo dõi ngữ cảnh dự án và lưu trữ phiên hội thoại bền vững.
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/60 p-3 bg-muted/10">
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">CLI Executable</div>
                                  <div className="font-mono text-xs text-foreground truncate select-all" title={agentCliDetectionByProvider.get("claude")?.commandPath || ""}>
                                    {agentCliDetectionByProvider.get("claude")?.commandPath || "claude (global npm package)"}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Configuration Directory</div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs text-foreground truncate select-all">~/.claudecode/</span>
                                    <button
                                      type="button"
                                      onClick={() => void openExternalPath("~/.claudecode")}
                                      className="text-primary hover:underline text-xs shrink-0 font-medium"
                                    >
                                      Reveal
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 border-t border-border/30 pt-4">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Default Preferences</div>
                                <ChatPreferenceControls
                                  availableProviders={settingsProviderCatalogs}
                                  selectedProvider="claude"
                                  showProviderPicker={false}
                                  providerLocked
                                  model={providerDefaults.claude.model}
                                  modelOptions={providerDefaults.claude.modelOptions}
                                  onModelChange={(_, model) => {
                                    handleProviderDefaultModelChange("claude", model)
                                  }}
                                  onModelOptionChange={(change) => {
                                    if (change.type === "claudeReasoningEffort") {
                                      handleProviderDefaultModelOptionsChange("claude", { reasoningEffort: change.effort })
                                    } else if (change.type === "contextWindow") {
                                      handleProviderDefaultModelOptionsChange("claude", { contextWindow: change.contextWindow })
                                    }
                                  }}
                                  planMode={providerDefaults.claude.planMode}
                                  onPlanModeChange={(planMode) => handleProviderDefaultPlanModeChange("claude", planMode)}
                                  includePlanMode
                                  className="justify-start flex-wrap gap-3"
                                />
                              </div>
                              <AgentConfigEditor agent="claude" socket={state.socket} />
                            </div>
                          )}

                          {openAgentAccordion === "codex" && (
                            <div className="space-y-5 text-sm">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <h4 className="text-sm font-semibold text-foreground">Codex Configuration</h4>
                                <AgentCliDetectionPill agent={agentCliDetectionByProvider.get("codex")} />
                              </div>

                              <div className="text-muted-foreground text-xs leading-relaxed">
                                Codex cung cấp khả năng sinh mã nguồn tốc độ cao và tối ưu hóa ngữ cảnh thông minh. Agent này sử dụng môi trường thực thi runtime tích hợp sẵn bên trong Kanna để giao tiếp trực tiếp với LLM.
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/60 p-3 bg-muted/10">
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">CLI Executable</div>
                                  <div className="font-mono text-xs text-foreground truncate">
                                    Built-in Kanna runtime
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Configuration Directory</div>
                                  <div className="font-mono text-xs text-foreground truncate select-all">
                                    Internal database config
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 border-t border-border/30 pt-4">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Default Preferences</div>
                                <ChatPreferenceControls
                                  availableProviders={settingsProviderCatalogs}
                                  selectedProvider="codex"
                                  showProviderPicker={false}
                                  providerLocked
                                  model={providerDefaults.codex.model}
                                  modelOptions={providerDefaults.codex.modelOptions}
                                  onModelChange={(_, model) => {
                                    handleProviderDefaultModelChange("codex", model)
                                  }}
                                  onModelOptionChange={(change) => {
                                    if (change.type === "codexReasoningEffort") {
                                      handleProviderDefaultModelOptionsChange("codex", { reasoningEffort: change.effort })
                                    } else if (change.type === "fastMode") {
                                      handleProviderDefaultModelOptionsChange("codex", { fastMode: change.fastMode })
                                    }
                                  }}
                                  planMode={providerDefaults.codex.planMode}
                                  onPlanModeChange={(planMode) => handleProviderDefaultPlanModeChange("codex", planMode)}
                                  includePlanMode
                                  className="justify-start flex-wrap gap-3"
                                />
                              </div>
                              <AgentConfigEditor agent="codex" socket={state.socket} />
                            </div>
                          )}

                          {openAgentAccordion === "antigravity" && (
                            <div className="space-y-5 text-sm">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <h4 className="text-sm font-semibold text-foreground">Antigravity Configuration</h4>
                                <AgentCliDetectionPill agent={agentCliDetectionByProvider.get("antigravity")} />
                              </div>

                              <div className="text-muted-foreground text-xs leading-relaxed">
                                Antigravity là một agent chuyên sâu về phân tích kiến trúc mã nguồn phức tạp và tự động hóa các thử nghiệm nghiên cứu thông tin dựa trên AI.
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/60 p-3 bg-muted/10">
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">CLI Executable</div>
                                  <div className="font-mono text-xs text-foreground truncate select-all" title={agentCliDetectionByProvider.get("antigravity")?.commandPath || ""}>
                                    {agentCliDetectionByProvider.get("antigravity")?.commandPath || "agy (global package)"}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Configuration Directory</div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs text-foreground truncate select-all">~/.antigravity/</span>
                                    <button
                                      type="button"
                                      onClick={() => void openExternalPath("~/.antigravity")}
                                      className="text-primary hover:underline text-xs shrink-0 font-medium"
                                    >
                                      Reveal
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 border-t border-border/30 pt-4">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</div>
                                <div className="flex flex-wrap gap-2">
                                  <StatusPill tone="neutral">Disabled</StatusPill>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  Antigravity is temporarily disabled due to agent stability issues.
                                </p>
                              </div>
                              <AgentConfigEditor agent="antigravity" socket={state.socket} />
                            </div>
                          )}

                          {openAgentAccordion === "pi" && (
                            <div className="space-y-5 text-sm">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <h4 className="text-sm font-semibold text-foreground">Pi Agent Configuration</h4>
                                <AgentCliDetectionPill agent={agentCliDetectionByProvider.get("pi")} />
                              </div>

                              <div className="text-muted-foreground text-xs leading-relaxed">
                                Pi Agent tự động hóa các tác vụ thông qua MCP servers cục bộ và các custom skills của nó. Kanna truy vấn Pi CLI runtime để khám phá động danh sách các công cụ khả dụng.
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/60 p-3 bg-muted/10">
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">CLI Executable</div>
                                  <div className="font-mono text-xs text-foreground truncate select-all" title={agentCliDetectionByProvider.get("pi")?.commandPath || ""}>
                                    {agentCliDetectionByProvider.get("pi")?.commandPath || "pi (global npm package)"}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Configuration Directory</div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs text-foreground truncate select-all">~/.pi/agent/</span>
                                    <button
                                      type="button"
                                      onClick={() => void openExternalPath("~/.pi/agent")}
                                      className="text-primary hover:underline text-xs shrink-0 font-medium"
                                    >
                                      Reveal
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3 border-t border-border/30 pt-4">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Default Preferences</div>
                                <ChatPreferenceControls
                                  availableProviders={settingsProviderCatalogs}
                                  selectedProvider="pi"
                                  showProviderPicker={false}
                                  providerLocked
                                  model={providerDefaults.pi.model}
                                  modelOptions={providerDefaults.pi.modelOptions}
                                  onModelChange={(_, model) => {
                                    handleProviderDefaultModelChange("pi", model)
                                  }}
                                  onModelOptionChange={(change) => {
                                    if (change.type === "piReasoningEffort") {
                                      handleProviderDefaultModelOptionsChange("pi", { reasoningEffort: change.effort as any })
                                    }
                                  }}
                                  planMode={providerDefaults.pi.planMode}
                                  onPlanModeChange={(planMode) => handleProviderDefaultPlanModeChange("pi", planMode)}
                                  includePlanMode
                                  className="justify-start flex-wrap gap-3"
                                />
                              </div>
                              <AgentConfigEditor agent="pi" socket={state.socket} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {agentCliDetectionError ? (
                      <SettingsRow
                        title="Local Agent Detection"
                        description={agentCliDetectionError}
                        alignStart
                      >
                        <StatusPill tone="neutral">Unavailable</StatusPill>
                      </SettingsRow>
                    ) : null}

                    <SettingsRow
                      title="Custom Agents"
                      description="Register local agent CLIs that Kanna should remember for future adapter support."
                      alignStart
                    >
                      <div className="flex w-full max-w-[520px] flex-col gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-fit gap-2"
                          onClick={() => {
                            resetCustomAgentDialog()
                            setCustomAgentDialogOpen(true)
                          }}
                        >
                          <Plus className="size-4" />
                          Add Custom Agent
                        </Button>
                        {(appSettings?.customAgents ?? []).length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {(appSettings?.customAgents ?? []).map((agent) => (
                              <CustomAgentCard key={agent.id} agent={agent} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No custom agents configured.</div>
                        )}
                      </div>
                    </SettingsRow>
                  </div>
                ) : selectedPage === "llm" ? (
                  <div className="border-b border-border space-y-6">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-6 py-5">
                      <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-semibold text-foreground">Quick Response SDK Fallback Mechanism</div>
                          <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            Quick Response SDK được sử dụng cho các tác vụ phụ trợ (như tóm tắt chat, tạo tiêu đề phiên chat, hoặc gợi ý code nhanh). Nếu không cấu hình thông tin kết nối dưới đây, hệ thống sẽ tự động fallback sang Claude Haiku hoặc Codex GPT-5.4 Mini để đảm bảo trải nghiệm liền mạch.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {llmProviderError ? (
                        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                          {llmProviderError}
                        </div>
                      ) : null}
                      {llmProvider?.warning ? (
                        <div className="mb-4 rounded-lg border border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
                          {llmProvider.warning}
                        </div>
                      ) : null}

                      {/* Provider Selection */}
                      <SettingsRow
                        title="LLM Provider"
                        description="Select the API provider for quick response tasks."
                        bordered={false}
                      >
                        <Select value={llmProviderDraft.provider} onValueChange={(value) => handleLlmProviderSelection(value as LlmProviderKind)}>
                          <SelectTrigger className="w-full min-w-[280px] md:w-[320px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {QUICK_RESPONSE_PROVIDER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </SettingsRow>

                      {/* Base URL (if custom) */}
                      {llmProviderDraft.provider === "custom" ? (
                        <SettingsRow
                          title="Base URL"
                          description="The API endpoint prefix for custom provider requests."
                        >
                          <Input
                            value={llmProviderDraft.baseUrl}
                            onChange={(event) => setLlmProviderDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                            onBlur={() => void commitLlmProvider()}
                            onKeyDown={(event) => handleTextInputKeyDown(event, () => void commitLlmProvider())}
                            placeholder="https://your-provider.example/v1"
                            className="w-full min-w-[280px] md:w-[320px] font-mono text-sm"
                          />
                        </SettingsRow>
                      ) : null}

                      {/* API Key */}
                      <SettingsRow
                        title="API Key"
                        description="Your authentication credentials for the selected provider."
                      >
                        <div className="relative flex w-full min-w-[280px] md:w-[320px] items-center">
                          <Input
                            type={showLlmApiKey ? "text" : "password"}
                            value={llmProviderDraft.apiKey}
                            onChange={(event) => setLlmProviderDraft((current) => ({ ...current, apiKey: event.target.value }))}
                            onBlur={() => void commitLlmProvider()}
                            onKeyDown={(event) => handleTextInputKeyDown(event, () => void commitLlmProvider())}
                            placeholder="API key"
                            className="pr-10 font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showLlmApiKey ? "Hide API Key" : "Show API Key"}
                          >
                            {showLlmApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </SettingsRow>

                      {/* Model ID */}
                      <SettingsRow
                        title="Model ID"
                        description="The specific model identifier to be used (e.g. gpt-4o, claude-3-5-sonnet-latest)."
                      >
                        <Input
                          value={llmProviderDraft.model}
                          onChange={(event) => setLlmProviderDraft((current) => ({ ...current, model: event.target.value }))}
                          onBlur={() => void commitLlmProvider()}
                          onKeyDown={(event) => handleTextInputKeyDown(event, () => void commitLlmProvider())}
                          placeholder="Model id"
                          className="w-full min-w-[280px] md:w-[320px] font-mono text-sm"
                        />
                      </SettingsRow>

                      {/* Connection Verification and Test */}
                      <SettingsRow
                        title="Connection Status"
                        description={
                          <>
                            <span>Validate credentials and test connection to the selected LLM provider.</span>
                            {llmProvider?.filePathDisplay ? (
                              <span className="block mt-1 text-xs text-muted-foreground">
                                Credentials are stored in {llmProvider.filePathDisplay}.
                              </span>
                            ) : null}
                          </>
                        }
                        alignStart
                      >
                        <div className="flex flex-col md:items-end gap-3 w-full min-w-[280px] md:w-[320px]">
                          <div className="text-sm">
                            {isValidatingLlm ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="size-4 animate-spin text-blue-500" />
                                <span>Validating credentials...</span>
                              </div>
                            ) : (
                              <div className="text-right">
                                {llmValidationStatus === "valid" ? (
                                  <span className="flex items-center justify-end gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="size-4" />
                                    Connection valid
                                  </span>
                                ) : llmValidationStatus === "invalid" ? (
                                  <span className="flex items-center justify-end gap-1.5 text-destructive font-medium">
                                    <AlertCircle className="size-4" />
                                    Connection invalid
                                    {llmValidationError ? (
                                      <button
                                        type="button"
                                        onClick={() => setLlmValidationDialogOpen(true)}
                                        className="underline underline-offset-2 hover:text-destructive/80 ml-1 text-xs"
                                      >
                                        See error
                                      </button>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Not tested yet</span>
                                )}
                              </div>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isValidatingLlm}
                            onClick={() => void commitLlmProvider()}
                            className="gap-2 w-full md:w-auto"
                          >
                            {isValidatingLlm ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="size-3.5" />
                            )}
                            Test Connection
                          </Button>
                        </div>
                      </SettingsRow>
                    </div>
                  </div>
                ) : selectedPage === "keybindings" ? (
                  <div className="border-b border-border">
                    {keybindingsError ? (
                      <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {keybindingsError}
                      </div>
                    ) : null}
                    {resolvedKeybindings.warning ? (
                      <div className="mb-4 rounded-lg border border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
                        {resolvedKeybindings.warning}
                      </div>
                    ) : null}
                    {KEYBINDING_ACTIONS.map((action, index) => {
                      const defaultValue = formatKeybindingInput(DEFAULT_KEYBINDINGS[action])
                      const currentValue = keybindingDrafts[action] ?? ""
                      const showRestore = currentValue !== defaultValue

                      return (
                        <SettingsRow
                          key={action}
                          title={KEYBINDING_ACTION_LABELS[action]}

                          description={(
                            <>
                              <span>Comma-separated shortcuts.</span>
                              {showRestore ? (
                                <>
                                  <span> </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void restoreDefaultKeybinding(action)
                                    }}
                                    className="inline rounded text-foreground hover:text-foreground/80"
                                  >
                                    Restore: {defaultValue}
                                  </button>
                                </>
                              ) : null}
                            </>
                          )}
                          bordered={index !== 0}

                        >
                          <div className="flex min-w-0 max-w-[420px] flex-1 flex-col items-stretch gap-2">
                            <Input
                              type="text"
                              value={currentValue}
                              onChange={(event) => {
                                const nextValue = event.target.value
                                setKeybindingDrafts((current) => ({ ...current, [action]: nextValue }))
                              }}
                              onBlur={() => {
                                void commitKeybindings()
                              }}
                              onKeyDown={(event) => handleTextInputKeyDown(event, () => {
                                void commitKeybindings()
                              })}
                              className="font-mono"
                            />
                          </div>
                        </SettingsRow>
                      )
                    })}
                  </div>
                ) : selectedPage === "skills" ? (
                  <SkillsSection state={state} defaultProvider={defaultProvider} />
                ) : selectedPage === "workflow" ? (
                  <WorkflowSection state={state} />
                ) : selectedPage === "mcp" ? (
                  <McpSection state={state} defaultProvider={defaultProvider} />
                ) : (
                  <ChangelogSection
                    status={changelogStatus}
                    releases={releases}
                    error={changelogError}
                    onRetry={retryChangelog}
                    updateSnapshot={updateSnapshot}
                    currentVersion={appVersion}
                    onInstallUpdate={() => {
                      void state.handleInstallUpdate()
                    }}
                    onCheckForUpdates={() => {
                      void state.handleCheckForUpdates({ force: true })
                    }}
                  />
                )}
              </div>
            )}

            {state.commandError ? (
              <div className="mx-auto mt-4 flex max-w-4xl items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{state.commandError}</span>
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {showFooter ? (
        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="px-6 py-[14.25px]">
            <div className="grid gap-3 text-xs text-muted-foreground grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="mb-1 uppercase tracking-wide text-[11px] text-muted-foreground/80">Machine</div>
                <div className="text-foreground/80">{machineName}</div>
              </div>
              <div className="hidden md:block">
                <div className="mb-1 uppercase tracking-wide text-[11px] text-muted-foreground/80">Connection</div>
                <div className="text-foreground/80">{state.connectionStatus}</div>
              </div>
              <div className="hidden md:block">
                <div className="mb-1 uppercase tracking-wide text-[11px] text-muted-foreground/80">Projects Indexed</div>
                <div className="text-foreground/80">{projectCount}</div>
              </div>
              <div>
                <div className="mb-1 uppercase tracking-wide text-[11px] text-muted-foreground/80">App Version</div>
                <div className="text-foreground/80">{appVersion}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Dialog open={customAgentDialogOpen} onOpenChange={(open) => {
        setCustomAgentDialogOpen(open)
        if (!open) resetCustomAgentDialog()
      }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Detect Custom Agent</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="custom-agent-name">Display Name</label>
              <Input
                id="custom-agent-name"
                value={customAgentDisplayName}
                onChange={(event) => setCustomAgentDisplayName(event.target.value)}
                placeholder="e.g. My Agent"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="custom-agent-command">Command</label>
              <Input
                id="custom-agent-command"
                value={customAgentCommand}
                onChange={(event) => {
                  setCustomAgentCommand(event.target.value)
                  setCustomAgentTestResult(null)
                }}
                placeholder="e.g. my-agent or /usr/local/bin/my-agent"
              />
              <div className="text-xs text-muted-foreground">The executable command to run the agent CLI.</div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="custom-agent-args">Arguments</label>
              <Input
                id="custom-agent-args"
                value={customAgentArgs}
                onChange={(event) => setCustomAgentArgs(event.target.value)}
                placeholder="e.g. --acp --verbose"
              />
              <div className="text-xs text-muted-foreground">Space-separated arguments passed to the command.</div>
            </div>
            <div className="grid gap-3">
              <div className="text-sm font-medium text-foreground">Environment Variables</div>
              {customAgentEnv.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    value={item.key}
                    onChange={(event) => updateCustomAgentEnv(index, { key: event.target.value })}
                    placeholder="KEY"
                  />
                  <Input
                    value={item.value}
                    onChange={(event) => updateCustomAgentEnv(index, { value: event.target.value })}
                    placeholder="value"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCustomAgentEnv((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label="Remove environment variable"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="w-fit gap-2"
                onClick={() => setCustomAgentEnv((items) => [...items, { key: "", value: "" }])}
              >
                <Plus className="size-4" />
                Add Variable
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={customAgentTesting}
              onClick={() => { void handleTestCustomAgent() }}
            >
              {customAgentTesting ? <Loader2 className="size-4 animate-spin" /> : null}
              Test Connection
            </Button>
            {customAgentTestResult ? (
              <div className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                customAgentTestResult.ok
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                  : "border-destructive/20 bg-destructive/5 text-destructive"
              )}>
                {customAgentTestResult.message}
              </div>
            ) : null}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="custom-agent-advanced">Advanced JSON</label>
              <Textarea
                id="custom-agent-advanced"
                value={customAgentAdvanced}
                onChange={(event) => setCustomAgentAdvanced(event.target.value)}
                className="min-h-[180px] font-mono text-xs"
                spellCheck={false}
              />
            </div>
            {customAgentError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {customAgentError}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCustomAgentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleSaveCustomAgent() }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
        <DialogContent size="lg">
          <DialogBody className="space-y-4">
            <DialogTitle>Tracked Events</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Kanna sends these event names plus the limited property keys below, depending on the event type.
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Event Names
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {analyticsDisclosureEvents.map((eventName) => (
                  <li key={eventName} className="font-mono text-foreground">
                    {eventName}
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Property Keys
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {ANALYTICS_STATIC_PROPERTY_NAMES.map((propertyName) => (
                  <li key={propertyName} className="font-mono text-foreground">
                    {propertyName}
                  </li>
                ))}
              </ul>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setAnalyticsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={llmValidationDialogOpen} onOpenChange={setLlmValidationDialogOpen}>
        <DialogContent size="lg">
          <DialogBody className="space-y-4">
            <DialogTitle>Validation Error</DialogTitle>
            <pre className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-words">
              {llmValidationErrorText}
            </pre>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setLlmValidationDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function buildKeybindingPayload(source: Record<string, string>): Record<KeybindingAction, string[]> {
  return {
    toggleEmbeddedTerminal: parseKeybindingInput(source.toggleEmbeddedTerminal ?? ""),
    toggleRightSidebar: parseKeybindingInput(source.toggleRightSidebar ?? ""),
    openInFinder: parseKeybindingInput(source.openInFinder ?? ""),
    openInEditor: parseKeybindingInput(source.openInEditor ?? ""),
    addSplitTerminal: parseKeybindingInput(source.addSplitTerminal ?? ""),
    jumpToSidebarChat: parseKeybindingInput(source.jumpToSidebarChat ?? ""),
    createChatInCurrentProject: parseKeybindingInput(source.createChatInCurrentProject ?? ""),
    openAddProject: parseKeybindingInput(source.openAddProject ?? ""),
  }
}
