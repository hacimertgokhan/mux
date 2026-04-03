/**
 * Skill installer: discover and install skills from GitHub repos.
 */

import { Config } from "@/config/config"
import { Log } from "@/util/log"
import path from "path"
import { Global } from "@/global"
import type { Discovery } from "./discovery"

const log = Log.create({ service: "skill-installer" })

export type GitHubSkill = {
  repo: string
  owner: string
  name: string
  description: string
  stars: number
  skills: SkillEntry[]
  url: string
  skillsUrl: string
}

export type SkillEntry = {
  name: string
  description: string
}

export type SearchResult = {
  items: GitHubSkill[]
  totalCount: number
  incompleteResults: boolean
}

const CURATED = [
  "anthropics/claude-code",
  "anthropics/skills",
  "vercel-labs/skills",
  "wshobson/awesome-claude-skills",
  "vercel-labs/agent-skills",
  "cloudflare/agents",
  "supabase/skills",
]

const SKILL_PATHS = [
  ".well-known/skills/index.json",
  "skills/index.json",
  ".agents/skills/index.json",
  ".claude/skills/index.json",
]

async function gh(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "opencode-mux" },
  })
  if (!res.ok) return null
  return res.json()
}

async function rawFile(owner: string, repo: string, filePath: string): Promise<any> {
  for (const branch of ["main", "master"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
    const res = await fetch(url)
    if (res.ok) return res.json().catch(() => null)
  }
  return null
}

export async function search(query: string, page = 1): Promise<SearchResult> {
  const perPage = 20

  if (!query?.trim()) {
    const items: GitHubSkill[] = []
    for (const repo of CURATED.slice(0, 8)) {
      const [owner, name] = repo.split("/")
      const skill = await inspect(owner, name)
      if (skill) items.push(skill)
    }
    return { items, totalCount: items.length, incompleteResults: false }
  }

  // GitHub code search
  const q = encodeURIComponent(`${query} filename:SKILL.md`)
  const codeRes = await gh(`https://api.github.com/search/code?q=${q}&per_page=${perPage}&page=${page}`)

  if (codeRes?.items?.length) {
    const seen = new Set<string>()
    const items: GitHubSkill[] = []
    for (const item of codeRes.items) {
      const full = item.repository.full_name
      if (seen.has(full)) continue
      seen.add(full)
      const [owner, repo] = full.split("/")
      items.push({
        owner,
        repo,
        name: repo,
        description: item.repository.description ?? "",
        stars: item.repository.stargazers_count ?? 0,
        url: item.repository.html_url,
        skillsUrl: `https://${full}/.well-known/skills/`,
        skills: [],
      })
      if (items.length >= perPage) break
    }
    return { items, totalCount: codeRes.total_count ?? 0, incompleteResults: false }
  }

  // Fallback: repo search
  const rq = encodeURIComponent(`${query} topic:skills OR topic:agent-skills`)
  const repoRes = await gh(
    `https://api.github.com/search/repositories?q=${rq}&per_page=${perPage}&page=${page}&sort=stars&order=desc`,
  )
  if (!repoRes?.items?.length) return { items: [], totalCount: 0, incompleteResults: false }

  const items = repoRes.items.map((r: any) => ({
    owner: r.owner.login,
    repo: r.name,
    name: r.name,
    description: r.description ?? "",
    stars: r.stargazers_count ?? 0,
    url: r.html_url,
    skillsUrl: `https://${r.owner.login}/${r.name}/.well-known/skills/`,
    skills: [],
  }))
  return { items, totalCount: repoRes.total_count ?? 0, incompleteResults: false }
}

export async function inspect(owner: string, repo: string): Promise<GitHubSkill | null> {
  const info = await gh(`https://api.github.com/repos/${owner}/${repo}`)
  if (!info) return null

  const skills: SkillEntry[] = []
  let foundPath = ""

  for (const p of SKILL_PATHS) {
    const data = await rawFile(owner, repo, p)
    if (data?.skills) {
      for (const s of data.skills) {
        if (s.name) skills.push({ name: s.name, description: s.description ?? "" })
      }
      foundPath = p
      break
    }
  }

  const base = foundPath ? path.dirname(foundPath) : ".well-known/skills"
  return {
    owner,
    repo,
    name: repo,
    description: info.description ?? "",
    stars: info.stargazers_count ?? 0,
    url: info.html_url,
    skillsUrl: `https://${owner}/${repo}/${base}/`,
    skills,
  }
}

export async function install(owner: string, repo: string): Promise<{ installed: string[]; url: string }> {
  const discovery = await getDiscovery()
  if (!discovery) {
    log.error("discovery service unavailable")
    return { installed: [], url: "" }
  }

  const patterns = [
    `https://${owner}/${repo}/.well-known/skills/`,
    `https://${owner}/${repo}/skills/`,
    `https://${owner}/${repo}/.agents/skills/`,
    `https://${owner}/${repo}/.claude/skills/`,
  ]

  let pulledDirs: string[] = []
  let workingUrl = ""

  for (const url of patterns) {
    try {
      const dirs = await discovery.pull(url)
      if (dirs.length > 0) {
        pulledDirs = dirs
        workingUrl = url
        break
      }
    } catch {}
  }

  if (pulledDirs.length === 0) {
    return { installed: [], url: "" }
  }

  // Update global config
  const cfg = await Config.getGlobal()
  const existingUrls = cfg.skills?.urls ?? []
  if (!existingUrls.includes(workingUrl)) {
    await Config.updateGlobal({
      ...cfg,
      skills: { ...cfg.skills, urls: [...existingUrls, workingUrl] },
    })
  }

  const names = pulledDirs.map((d) => path.basename(d))
  log.info("installed skills", { count: names.length, names })
  return { installed: names, url: workingUrl }
}

export async function installedRepos(): Promise<string[]> {
  const cfg = await Config.getGlobal()
  const urls = cfg.skills?.urls ?? []
  return urls.map((url) => {
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    return m ? `${m[1]}/${m[2]}` : url.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/")
  })
}

// Discovery interface wrapper (non-Effect)
type DiscoveryPull = { pull: (url: string) => Promise<string[]> }

let _discoveryPromise: Promise<DiscoveryPull | null> | null = null
async function getDiscovery(): Promise<DiscoveryPull | null> {
  if (_discoveryPromise) return _discoveryPromise
  _discoveryPromise = (async () => {
    try {
      const { Discovery } = await import("./discovery")
      const { Effect } = await import("effect")

      // Use defaultLayer which already has all dependencies
      const eff = Effect.gen(function* () {
        const svc = yield* Discovery.Service
        return { pull: (url: string) => Effect.runPromise(svc.pull(url)) }
      })

      return Effect.runPromise(Effect.provide(eff, Discovery.defaultLayer))
    } catch (e) {
      log.error("failed to initialize discovery", { error: String(e) })
      return null
    }
  })()
  return _discoveryPromise
}
