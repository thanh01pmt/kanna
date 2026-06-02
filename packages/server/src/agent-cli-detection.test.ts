import { describe, expect, test } from "bun:test"
import { detectAgentCli, detectAgentClis, testCustomAgentConnection } from "./agent-cli-detection"

describe("agent CLI detection", () => {
  test("marks a provider detected when any candidate command resolves", () => {
    const detected = detectAgentCli(
      { provider: "antigravity", commands: ["agy", "antigravity"] },
      {
        now: new Date("2026-06-02T00:00:00.000Z"),
        resolver(command) {
          return command === "agy" ? "/opt/homebrew/bin/agy" : null
        },
      }
    )

    expect(detected).toMatchObject({
      provider: "antigravity",
      label: "Antigravity",
      status: "detected",
      command: "agy",
      commandPath: "/opt/homebrew/bin/agy",
      candidateCommands: ["agy", "antigravity"],
      detectedAt: "2026-06-02T00:00:00.000Z",
    })
  })

  test("marks a provider missing when no candidate command resolves", () => {
    expect(detectAgentCli(
      { provider: "pi", commands: ["pi", "pi-agent"] },
      { resolver: () => null }
    )).toMatchObject({
      provider: "pi",
      status: "missing",
      command: "pi",
      commandPath: null,
    })
  })

  test("returns a snapshot for all probes", () => {
    const snapshot = detectAgentClis({
      now: new Date("2026-06-02T00:00:00.000Z"),
      probes: [
        { provider: "claude", commands: ["claude"] },
        { provider: "codex", commands: ["codex"] },
      ],
      resolver(command) {
        return command === "codex" ? "/usr/local/bin/codex" : null
      },
    })

    expect(snapshot.agents.map((agent) => [agent.provider, agent.status])).toEqual([
      ["claude", "missing"],
      ["codex", "detected"],
    ])
  })

  test("tests custom agent commands by resolving the executable", () => {
    expect(testCustomAgentConnection(
      { command: "my-agent", args: "--verbose", env: [] },
      { resolver: (command) => command === "my-agent" ? "/usr/local/bin/my-agent" : null }
    )).toEqual({
      ok: true,
      commandPath: "/usr/local/bin/my-agent",
      message: "Command resolved to /usr/local/bin/my-agent.",
    })

    expect(testCustomAgentConnection(
      { command: "missing-agent", args: "", env: [] },
      { resolver: () => null }
    )).toMatchObject({
      ok: false,
      commandPath: null,
    })
  })
})
