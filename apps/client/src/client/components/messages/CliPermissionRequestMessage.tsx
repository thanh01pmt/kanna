import { Check, ShieldAlert, X } from "lucide-react"
import type { ProcessedToolCall } from "./types"
import { Button } from "../ui/button"

interface Props {
  message: Extract<ProcessedToolCall, { toolKind: "cli_permission_request" }>
  onRespond: (toolUseId: string, choice: string, approved: boolean) => void
  isLatest: boolean
}

export function CliPermissionRequestMessage({ message, onRespond, isLatest }: Props) {
  const isComplete = Boolean(message.result)
  const input = message.input
  const denyOption = input.options.find((option) => /^no$/i.test(option.label) || option.value === "4")
  const approveOptions = input.options.filter((option) => option !== denyOption)

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">
            {input.provider === "pi" ? "Pi" : "Antigravity"} requests command permission
          </div>
          <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-xs text-foreground">
            {input.command || input.prompt}
          </pre>

          {isComplete ? (
            <div className="mt-3 text-xs text-muted-foreground">
              {message.result?.approved ? "Approved" : "Denied"}
            </div>
          ) : !isLatest ? (
            <div className="mt-3 text-xs italic text-muted-foreground">Permission pending in an older turn</div>
          ) : (
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {approveOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  onClick={() => onRespond(message.toolId, option.value, true)}
                  className="rounded-full"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {option.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRespond(message.toolId, denyOption?.value ?? "4", false)}
                className="rounded-full border-border"
              >
                <X className="mr-1.5 h-4 w-4" />
                Deny
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
