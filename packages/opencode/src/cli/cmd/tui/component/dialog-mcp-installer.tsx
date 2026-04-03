import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createResource, createMemo, createSignal } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "@tui/context/sdk"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { Locale } from "@/util/locale"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"

type McpRegistryEntry = {
  name: string
  description: string
  category: string
  type: "local" | "remote"
  command?: string[]
  url?: string
  envHint?: Record<string, string>
  website: string
  stars: number
  installed: boolean
}

// Curated registry of popular MCP servers
const MCP_REGISTRY: Omit<McpRegistryEntry, "installed" | "stars">[] = [
  {
    name: "filesystem",
    description: "Read, write, and manage files on your system",
    category: "System",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "github",
    description: "GitHub API: repos, issues, PRs, and more",
    category: "Development",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-github"],
    envHint: { GITHUB_PERSONAL_ACCESS_TOKEN: "Your GitHub PAT" },
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "git",
    description: "Git operations: log, diff, status, commit",
    category: "Development",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-git"],
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "postgresql",
    description: "Read-only PostgreSQL database queries",
    category: "Database",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-postgres"],
    envHint: { DATABASE_URL: "postgresql://..." },
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "sqlite",
    description: "SQLite database interaction",
    category: "Database",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-sqlite"],
    envHint: { SQLITE_DB_PATH: "/path/to/db.sqlite" },
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "fetch",
    description: "Web content fetching and reading",
    category: "Web",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-fetch"],
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "puppeteer",
    description: "Headless browser automation",
    category: "Web",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-puppeteer"],
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "slack",
    description: "Slack messaging and channels",
    category: "Communication",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-slack"],
    envHint: { SLACK_BOT_TOKEN: "xoxb-...", SLACK_TEAM_ID: "T01234567" },
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "google-maps",
    description: "Google Maps geocoding, places, directions",
    category: "Location",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-google-maps"],
    envHint: { GOOGLE_MAPS_API_KEY: "Your API key" },
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "brave-search",
    description: "Web search via Brave Search API",
    category: "Search",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-brave-search"],
    envHint: { BRAVE_API_KEY: "Your Brave Search API key" },
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "memory",
    description: "Persistent knowledge graph for context",
    category: "Memory",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-memory"],
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "sequential-thinking",
    description: "Structured step-by-step reasoning",
    category: "Reasoning",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
    website: "https://github.com/modelcontextprotocol/servers",
  },
  {
    name: "everart",
    description: "AI image generation",
    category: "Creative",
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-everart"],
    envHint: { EVERART_API_KEY: "Your EverArt API key" },
    website: "https://github.com/modelcontextprotocol/servers",
  },
]

export function DialogMcpInstaller() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const { theme } = useTheme()
  dialog.setSize("large")

  const [filter, setFilter] = createSignal("")

  const [cfg] = createResource(async () => {
    try {
      const res = await sdk.client.config.get()
      return res.data
    } catch {
      return undefined
    }
  })

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const configData = cfg()
    const existingMcp = (configData as any)?.mcp ?? {}
    const needle = filter().toLowerCase()

    return MCP_REGISTRY.filter(
      (entry) =>
        !needle ||
        entry.name.toLowerCase().includes(needle) ||
        entry.description.toLowerCase().includes(needle) ||
        entry.category.toLowerCase().includes(needle),
    ).map((entry) => {
      const installed = !!existingMcp[entry.name]
      const envHint = entry.envHint
        ? `env: ${Object.keys(entry.envHint).join(", ")}`
        : ""

      return {
        title: `${entry.name.padEnd(22)} ${entry.type === "local" ? "📦" : "🌐"} ${entry.category}`,
        value: entry.name,
        description: Locale.truncate(entry.description, 55) + (envHint ? ` [${envHint}]` : ""),
        category: installed ? "Installed" : "Available",
        onSelect: () => handleInstall(entry),
      }
    })
  })

  async function handleInstall(entry: typeof MCP_REGISTRY[number]) {
    const configData = cfg()
    const existingMcp = (configData as any)?.mcp ?? {}

    if (existingMcp[entry.name]) {
      await DialogAlert.show(dialog, "Already Installed", `${entry.name} MCP server is already configured.`)
      return
    }

    let envVars: Record<string, string> | undefined
    if (entry.envHint) {
      const envKeys = Object.keys(entry.envHint)
      const envPrompt = await DialogPrompt.show(dialog, `Environment Variables for ${entry.name}`, {
        placeholder: envKeys.map((k) => `${k}=`).join("\n"),
      })
      if (envPrompt) {
        envVars = {}
        for (const line of envPrompt.split("\n")) {
          const eqIdx = line.indexOf("=")
          if (eqIdx > 0) {
            envVars[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim()
          }
        }
        if (Object.keys(envVars).length === 0) envVars = undefined
      }
    }

    const confirmed = await DialogConfirm.show(
      dialog,
      `Install ${entry.name}`,
      `Add ${entry.name} MCP server?\n\nType: ${entry.type}\n${entry.type === "local" ? `Command: ${entry.command?.join(" ")}` : `URL: ${entry.url}`}${envVars ? `\nEnv: ${Object.keys(envVars).join(", ")}` : ""}`,
      "Install",
    )

    if (!confirmed) return

    const mcpConfig: any = entry.type === "local"
      ? { type: "local", command: entry.command, environment: envVars }
      : { type: "remote", url: entry.url }

    try {
      const newMcp = { ...existingMcp, [entry.name]: mcpConfig }
      await sdk.client.config.update({ ...configData, mcp: newMcp } as any)
      // Refresh MCP status
      const status = await sdk.client.mcp.status()
      if (status.data) sync.set("mcp", status.data)
      await DialogAlert.show(dialog, "Installed ✓", `${entry.name} MCP server has been added.`)
    } catch (e: any) {
      await DialogAlert.show(dialog, "Install Failed", e.message ?? String(e))
    }
  }

  return (
    <DialogSelect
      title="Install MCP Servers"
      placeholder="Search MCP servers..."
      options={options()}
      onFilter={(q) => setFilter(q)}
      keybind={[]}
    />
  )
}
