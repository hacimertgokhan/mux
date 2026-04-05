#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const output = [`version=${Script.version}`]

async function generateChangelog(from: string, to: string): Promise<string> {
  const log = await $`git log ${from}..${to} --pretty=format:"%s" --no-merges`.text()
  const commits = log.trim().split("\n").filter(Boolean)

  const sections: Record<string, string[]> = {
    Features: [],
    Fixes: [],
    Improvements: [],
    Other: [],
  }

  for (const commit of commits) {
    const lower = commit.toLowerCase()
    if (lower.startsWith("feat") || lower.startsWith("add")) {
      sections.Features!.push(commit.replace(/^(feat|feat\([^)]+\)|add)[\s:]*[-\s]*/i, ""))
    } else if (lower.startsWith("fix") || lower.startsWith("bugfix")) {
      sections.Fixes!.push(commit.replace(/^(fix|fix\([^)]+\)|bugfix)[\s:]*[-\s]*/i, ""))
    } else if (
      lower.startsWith("improve") ||
      lower.startsWith("enhance") ||
      lower.startsWith("refactor") ||
      lower.startsWith("perf")
    ) {
      sections.Improvements!.push(commit.replace(/^(improve|improvement|enhance|refactor|perf)[\s:]*[-\s]*/i, ""))
    } else {
      sections.Other!.push(commit)
    }
  }

  const lines: string[] = []
  for (const [section, items] of Object.entries(sections)) {
    if (items.length === 0) continue
    lines.push(`### ${section}`)
    lines.push("")
    for (const item of items) {
      lines.push(`- ${item}`)
    }
    lines.push("")
  }

  return lines.length > 0 ? lines.join("\n") : "No notable changes"
}

if (!Script.preview) {
  const sha = process.env.GITHUB_SHA ?? (await $`git rev-parse HEAD`.text()).trim()
  const lastTag = await $`git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD`
    .text()
    .then((r) => r.trim())
    .catch(() => "")

  let body: string
  try {
    await $`bun script/changelog.ts --to ${sha}`.cwd(process.cwd())
    body = await Bun.file(`${process.cwd()}/UPCOMING_CHANGELOG.md`)
      .text()
      .catch(() => "")
  } catch {
    body = ""
  }

  if (!body.trim()) {
    body = await generateChangelog(lastTag || sha, sha)
  }

  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const notesFile = `${dir}/opencode-release-notes.txt`
  await Bun.write(notesFile, body)
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes-file ${notesFile}`
  const release = await $`gh release view v${Script.version} --json tagName,databaseId`.json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
} else if (Script.channel === "beta") {
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --repo ${process.env.GH_REPO}`
  const release =
    await $`gh release view v${Script.version} --json tagName,databaseId --repo ${process.env.GH_REPO}`.json()
  output.push(`release=${release.databaseId}`)
  output.push(`tag=${release.tagName}`)
}

output.push(`repo=${process.env.GH_REPO}`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
