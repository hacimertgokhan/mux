import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { createMemo } from "solid-js"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "@tui/context/sdk"
import { DialogSkillInstallerBrowse } from "./dialog-skill-installer-browse"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { DialogAlert } from "@tui/ui/dialog-alert"
import { DialogSkill } from "./dialog-skill"

export function DialogSkillInstaller() {
  const dialog = useDialog()
  const sdk = useSDK()
  dialog.setSize("large")

  const options = createMemo<DialogSelectOption<string>[]>(() => [
    {
      title: "Browse & Search",
      value: "browse",
      description: "Search GitHub for skill repositories",
      category: "Discover",
      onSelect: () => {
        dialog.replace(() => <DialogSkillInstallerBrowse />)
      },
    },
    {
      title: "Add Repository URL",
      value: "add-url",
      description: "Install skills from a direct URL",
      category: "Discover",
      onSelect: async () => {
        const url = await DialogPrompt.show(dialog, "Add Skill URL", {
          placeholder: "https://github.com/owner/repo",
        })
        if (!url) return
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
        if (!match) {
          await DialogAlert.show(dialog, "Invalid URL", "Please enter a valid GitHub repository URL.")
          return
        }
        const [, owner, repo] = match
        const baseUrl = sdk.url.replace(/\/$/, "")
        const res = await fetch(`${baseUrl}/skill-installer/install`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, repo }),
        })
        const data = await res.json()
        if (data?.installed?.length) {
          await DialogAlert.show(dialog, "Skills Installed", `Installed: ${data.installed.join(", ")}`)
        } else {
          await DialogAlert.show(dialog, "No Skills Found", `No installable skills found in ${owner}/${repo}.`)
        }
      },
    },
    {
      title: "View Installed Skills",
      value: "view-local",
      description: "Manage locally installed skills",
      category: "Manage",
      onSelect: () => {
        dialog.replace(() => <DialogSkill onSelect={() => dialog.clear()} />)
      },
    },
  ])

  return <DialogSelect title="Install Skills" placeholder="Choose an option..." options={options()} />
}
