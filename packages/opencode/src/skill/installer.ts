/**
 * Skill installer: discover and install skills from GitHub repos.
 */

import { Config } from "@/config/config"
import { Filesystem } from "@/util/filesystem"
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

export type InstallScope = "global" | "project"
export type InstallResult = { installed: string[]; url: string }

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

type RepoInfo = {
  default_branch?: string
  description?: string
  stargazers_count?: number
  html_url: string
}

type RepoSearchItem = {
  owner: { login: string }
  name: string
  default_branch?: string
  description?: string
  stargazers_count?: number
  html_url: string
}

type CodeSearchItem = {
  repository: {
    full_name: string
    default_branch?: string
    description?: string
    stargazers_count?: number
    html_url: string
  }
}

type SkillsIndex = {
  skills?: { name?: string; description?: string }[]
}

type GitTreeItem = {
  path: string
  type: "blob" | "tree"
}

type GitTree = {
  tree?: GitTreeItem[]
}

type GitMd = {
  owner: string
  repo: string
  branch: string
  file: string
  raw: string
}

function heads(head?: string) {
  return [...new Set([head, "main", "master"].filter((item): item is string => Boolean(item)))]
}

async function gh<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "opencode-mux" },
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

async function rawFile(
  owner: string,
  repo: string,
  filePath: string,
  branchList?: string[],
): Promise<SkillsIndex | null> {
  for (const branch of branchList ?? ["main", "master"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
    const res = await fetch(url)
    if (res.ok) return (await res.json().catch(() => null)) as SkillsIndex | null
  }
  return null
}

function roots(tree: GitTreeItem[]) {
  return [
    ...new Set(
      tree
        .filter((item) => item.type === "blob")
        .map((item) => item.path)
        .filter((item) =>
          /^(?:\.well-known\/skills|skills|\.agents\/skills|\.claude\/skills)\/[^/]+\/SKILL\.md$/.test(item),
        )
        .map((item) => item.slice(0, -"/SKILL.md".length)),
    ),
  ]
}

async function pullFromTree(owner: string, repo: string, branch: string) {
  const tree = await gh<GitTree>(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)
  const list = tree?.tree ?? []
  const skillRoots = roots(list)
  const dirs: string[] = []

  for (const root of skillRoots) {
    const name = path.basename(root)
    const files = list
      .filter((item) => item.type === "blob" && item.path.startsWith(root + "/"))
      .map((item) => item.path)
    if (!files.includes(`${root}/SKILL.md`)) continue

    const dir = path.join(Global.Path.cache, "skills", name)
    for (const file of files) {
      const rel = file.slice(root.length + 1)
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`
      const res = await fetch(url)
      if (!res.ok) continue
      const body = await res.arrayBuffer()
      await Filesystem.write(path.join(dir, rel), new Uint8Array(body))
    }

    if (await Filesystem.exists(path.join(dir, "SKILL.md"))) {
      dirs.push(dir)
    }
  }

  return dirs
}

function unique(list: string[]) {
  return [...new Set(list)]
}

function slug(input: string) {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return text || "custom-skill"
}

function cleanUrl(input: string) {
  return input.trim().replace(/[?#].*$/, "")
}

export function isMarkdownUrl(input: string) {
  const url = cleanUrl(input)
  return /^https?:\/\/\S+\.md$/i.test(url)
}

function parseGitMd(input: string): GitMd | null {
  const url = cleanUrl(input)
  const blob = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+\.md)$/i)
  if (blob) {
    const owner = blob[1]
    const repo = blob[2].replace(/\.git$/i, "")
    const branch = blob[3]
    const file = blob[4]
    return {
      owner,
      repo,
      branch,
      file,
      raw: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`,
    }
  }

  const raw = url.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+\.md)$/i)
  if (raw) {
    return {
      owner: raw[1],
      repo: raw[2].replace(/\.git$/i, ""),
      branch: raw[3],
      file: raw[4],
      raw: url,
    }
  }

  return null
}

async function pullRoot(owner: string, repo: string, branch: string, root: string) {
  const tree = await gh<GitTree>(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)
  const list = tree?.tree ?? []
  const files = list
    .filter((item) => item.type === "blob" && (item.path === `${root}/SKILL.md` || item.path.startsWith(root + "/")))
    .map((item) => item.path)
  if (!files.includes(`${root}/SKILL.md`)) return null

  const dir = path.join(Global.Path.cache, "skills", path.basename(root))
  for (const file of files) {
    const rel = file.slice(root.length + 1)
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`
    const res = await fetch(url)
    if (!res.ok) continue
    const body = await res.arrayBuffer()
    await Filesystem.write(path.join(dir, rel), new Uint8Array(body))
  }

  return (await Filesystem.exists(path.join(dir, "SKILL.md"))) ? dir : null
}

async function apply(scope: InstallScope, dirs: string[], url: string) {
  if (scope === "project") {
    const cfg = await Config.get()
    const paths = unique([...(cfg.skills?.paths ?? []), ...dirs])
    await Config.update({
      ...cfg,
      skills: { ...cfg.skills, paths },
    })
  } else {
    const cfg = await Config.getGlobal()
    const paths = unique([...(cfg.skills?.paths ?? []), ...(url ? [] : dirs)])
    const old = cfg.skills?.urls ?? []
    const norm = url.replace(/\/+$/, "")
    const legacy = norm.replace("https://raw.githubusercontent.com/", "https://")
    const has = old.some((item) => {
      const next = item.replace(/\/+$/, "")
      return next === norm || next === legacy
    })
    const urls = url && !has ? [...old, url] : old
    await Config.updateGlobal({
      ...cfg,
      skills: { ...cfg.skills, urls, paths },
    })
  }

  const names = dirs.map((dir) => path.basename(dir))
  log.info("installed skills", { count: names.length, names })
  return names
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
  const codeRes = await gh<{ items?: CodeSearchItem[]; total_count?: number }>(
    `https://api.github.com/search/code?q=${q}&per_page=${perPage}&page=${page}`,
  )

  if (codeRes?.items?.length) {
    const seen = new Set<string>()
    const items: GitHubSkill[] = []
    for (const item of codeRes.items) {
      const full = item.repository.full_name
      if (seen.has(full)) continue
      seen.add(full)
      const [owner, repo] = full.split("/")
      const branch = heads(item.repository.default_branch)[0] ?? "main"
      items.push({
        owner,
        repo,
        name: repo,
        description: item.repository.description ?? "",
        stars: item.repository.stargazers_count ?? 0,
        url: item.repository.html_url,
        skillsUrl: `https://github.com/${full}/tree/${branch}/.well-known/skills/`,
        skills: [],
      })
      if (items.length >= perPage) break
    }
    return { items, totalCount: codeRes.total_count ?? 0, incompleteResults: false }
  }

  // Fallback: repo search
  const rq = encodeURIComponent(`${query} topic:skills OR topic:agent-skills`)
  const repoRes = await gh<{ items?: RepoSearchItem[]; total_count?: number }>(
    `https://api.github.com/search/repositories?q=${rq}&per_page=${perPage}&page=${page}&sort=stars&order=desc`,
  )
  if (!repoRes?.items?.length) return { items: [], totalCount: 0, incompleteResults: false }

  const items = repoRes.items.map((r) => ({
    owner: r.owner.login,
    repo: r.name,
    name: r.name,
    description: r.description ?? "",
    stars: r.stargazers_count ?? 0,
    url: r.html_url,
    skillsUrl: `https://github.com/${r.owner.login}/${r.name}/tree/${heads(r.default_branch)[0] ?? "main"}/.well-known/skills/`,
    skills: [],
  }))
  return { items, totalCount: repoRes.total_count ?? 0, incompleteResults: false }
}

export async function inspect(owner: string, repo: string): Promise<GitHubSkill | null> {
  const info = await gh<RepoInfo>(`https://api.github.com/repos/${owner}/${repo}`)
  if (!info) return null

  const skills: SkillEntry[] = []
  let foundPath = ""
  const branch = heads(info.default_branch)

  for (const p of SKILL_PATHS) {
    const data = await rawFile(owner, repo, p, branch)
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
    skillsUrl: `https://github.com/${owner}/${repo}/tree/${branch[0] ?? "main"}/${base}/`,
    skills,
  }
}

export async function install(owner: string, repo: string, input?: { scope?: InstallScope }): Promise<InstallResult> {
  const discovery = await getDiscovery()
  if (!discovery) {
    log.error("discovery service unavailable")
    return { installed: [], url: "" }
  }

  const scope = input?.scope ?? "global"
  const info = await gh<{ default_branch?: string }>(`https://api.github.com/repos/${owner}/${repo}`)
  const branch = heads(info?.default_branch)[0] ?? "main"
  const patterns = heads(info?.default_branch).flatMap((branch) => [
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.well-known/skills/`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.agents/skills/`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.claude/skills/`,
  ])

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
    } catch (err) {
      log.warn("discovery pull failed", { url, error: String(err) })
    }
  }

  if (pulledDirs.length === 0) {
    pulledDirs = await pullFromTree(owner, repo, branch)
    if (pulledDirs.length === 0) {
      return { installed: [], url: "" }
    }
  }

  return { installed: await apply(scope, pulledDirs, workingUrl), url: workingUrl }
}

export async function installFromUrl(url: string, input?: { scope?: InstallScope }): Promise<InstallResult> {
  const scope = input?.scope ?? "global"
  if (!isMarkdownUrl(url)) return { installed: [], url: "" }

  const hit = parseGitMd(url)
  if (hit && path.basename(hit.file).toLowerCase() === "skill.md") {
    const dir = await pullRoot(hit.owner, hit.repo, hit.branch, path.dirname(hit.file))
    if (dir) return { installed: await apply(scope, [dir], ""), url: cleanUrl(url) }
  }

  const src = hit?.raw ?? cleanUrl(url)
  const res = await fetch(src)
  if (!res.ok) return { installed: [], url: "" }
  const body = await res.arrayBuffer()
  const file = src.split("/").pop() ?? "skill.md"
  const stem = file.replace(/\.md$/i, "")
  const name = slug(stem.toLowerCase() === "skill" && hit ? path.basename(path.dirname(hit.file)) : stem)
  const dir = path.join(Global.Path.cache, "skills", name)
  await Filesystem.write(path.join(dir, "SKILL.md"), new Uint8Array(body))
  if (!(await Filesystem.exists(path.join(dir, "SKILL.md")))) return { installed: [], url: "" }
  return { installed: await apply(scope, [dir], ""), url: cleanUrl(url) }
}

export async function installedRepos(): Promise<string[]> {
  const cfg = await Config.getGlobal()
  const urls = cfg.skills?.urls ?? []
  return urls.map((url) => {
    const m = url.match(/github\.com\/([^/]+)\/([^/]+)/) ?? url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)/)
    return m
      ? `${m[1]}/${m[2]}`
      : url
          .replace(/^https?:\/\//, "")
          .split("/")
          .slice(0, 2)
          .join("/")
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

      const eff = Effect.gen(function* () {
        const svc = yield* Discovery.Service
        return { pull: (url: string) => Effect.runPromise(svc.pull(url)) }
      })

      return Effect.runPromise(Effect.provide(eff, Discovery.defaultLayer))
    } catch (e) {
      log.error("failed to initialize discovery", { error: String(e) })
      _discoveryPromise = null
      return null
    }
  })()
  return _discoveryPromise
}
