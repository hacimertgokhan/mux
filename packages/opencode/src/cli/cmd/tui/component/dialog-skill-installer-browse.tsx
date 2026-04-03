import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createResource, createMemo } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "@tui/context/sdk"
import { DialogConfirm } from "@tui/ui/dialog-confirm"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { Locale } from "@/util/locale"

type RepoItem = {
  owner: string
  repo: string
  name: string
  description: string
  stars: number
  skillCount: number
  skills: { name: string; description: string }[]
  url: string
}

export function DialogSkillInstallerBrowse() {
  const dialog = useDialog()
  const sdk = useSDK()
  dialog.setSize("large")

  const [results, { refetch }] = createResource(async () => {
    try {
      const baseUrl = sdk.url.replace(/\/$/, "")
      const res = await fetch(`${baseUrl}/skill-installer/search`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.items ?? []).map((item: any) => ({
        owner: item.owner,
        repo: item.repo,
        name: item.name,
        description: item.description ?? "",
        stars: item.stars ?? 0,
        skillCount: item.skills?.length ?? 0,
        skills: item.skills ?? [],
        url: item.url,
      })) as RepoItem[]
    } catch {
      return []
    }
  }, { initialValue: [] })

  const [installedRepos] = createResource(async () => {
    try {
      const baseUrl = sdk.url.replace(/\/$/, "")
      const res = await fetch(`${baseUrl}/skill-installer/installed`)
      if (!res.ok) return new Set<string>()
      const data = await res.json()
      return new Set(data ?? [])
    } catch {
      return new Set<string>()
    }
  })

  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const installed = installedRepos() ?? new Set<string>()
    return (results() ?? []).map((item) => {
      const key = `${item.owner}/${item.repo}`
      const starsStr = item.stars > 1000 ? `${(item.stars / 1000).toFixed(1)}k` : String(item.stars)
      const skillInfo = item.skillCount > 0 ? `${item.skillCount} skills` : "scan needed"
      const installedTag = installed.has(key) ? " ✓" : ""

      return {
        title: `${item.name.padEnd(25)} ★${starsStr.padStart(6)}  ${skillInfo}${installedTag}`,
        value: key,
        description: Locale.truncate(item.description, 60),
        category: installed.has(key) ? "Installed" : "Available",
        onSelect: () => handleInstall(item),
      }
    })
  })

  async function handleInstall(item: RepoItem) {
    const skillList = item.skills.length > 0
      ? item.skills.slice(0, 6).map((s) => `  • ${s.name}${s.description ? `: ${s.description.slice(0, 40)}` : ""}`).join("\n")
      : "All available skills will be discovered and installed"

    const confirmed = await DialogConfirm.show(
      dialog,
      "Install Skills",
      `Install from ${item.owner}/${item.repo}?\n\n${skillList}${item.skills.length > 6 ? `\n  ... and ${item.skills.length - 6} more` : ""}`,
      "Install",
    )

    if (!confirmed) return

    try {
      const baseUrl = sdk.url.replace(/\/$/, "")
      const res = await fetch(`${baseUrl}/skill-installer/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: item.owner, repo: item.repo }),
      })
      const data = await res.json()
      if (data?.installed?.length) {
        await DialogAlert.show(
          dialog,
          "Skills Installed ✓",
          `Installed:\n${data.installed.map((n: string) => `  • ${n}`).join("\n")}`,
        )
        refetch()
      } else {
        await DialogAlert.show(dialog, "No Skills Found", `No installable skills found in ${item.owner}/${item.repo}.`)
      }
    } catch (e: any) {
      await DialogAlert.show(dialog, "Install Failed", e.message ?? String(e))
    }
  }

  return (
    <DialogSelect
      title="Browse Skills"
      placeholder="Search GitHub for skills..."
      options={options()}
      keybind={[]}
    />
  )
}
