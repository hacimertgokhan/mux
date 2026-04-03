import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import z from "zod"
import { lazy } from "@/util/lazy"
import * as Installer from "../../skill/installer"

export const SkillInstallerRoutes = lazy(() =>
  new Hono()
    .get(
      "/search",
      describeRoute({
        summary: "Search for skills on GitHub",
        description: "Search GitHub repositories containing SKILL.md files.",
        operationId: "skill-installer.search",
        responses: {
          200: {
            description: "Search results",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    items: z.array(
                      z.object({
                        owner: z.string(),
                        repo: z.string(),
                        name: z.string(),
                        description: z.string(),
                        stars: z.number(),
                        url: z.string(),
                        skillsUrl: z.string(),
                        skills: z.array(
                          z.object({
                            name: z.string(),
                            description: z.string(),
                          }),
                        ),
                      }),
                    ),
                    totalCount: z.number(),
                    incompleteResults: z.boolean(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const query = c.req.query("q") ?? ""
        const page = parseInt(c.req.query("page") ?? "1")
        const result = await Installer.search(query, page)
        return c.json(result)
      },
    )
    .get(
      "/inspect",
      describeRoute({
        summary: "Inspect a skill repository",
        description: "Get detailed information about skills in a GitHub repository.",
        operationId: "skill-installer.inspect",
        responses: {
          200: {
            description: "Repository details with skills",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    owner: z.string(),
                    repo: z.string(),
                    name: z.string(),
                    description: z.string(),
                    stars: z.number(),
                    url: z.string(),
                    skillsUrl: z.string(),
                    skills: z.array(
                      z.object({
                        name: z.string(),
                        description: z.string(),
                      }),
                    ),
                  }).nullable(),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const owner = c.req.query("owner")
        const repo = c.req.query("repo")
        if (!owner || !repo) {
          return c.json(null)
        }
        const result = await Installer.inspect(owner, repo)
        return c.json(result)
      },
    )
    .post(
      "/install",
      describeRoute({
        summary: "Install skills from a repository",
        description: "Download and install skills from a GitHub repository.",
        operationId: "skill-installer.install",
        responses: {
          200: {
            description: "Installation result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    installed: z.array(z.string()),
                    url: z.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const body = await c.req.json<{ owner: string; repo: string }>()
        const result = await Installer.install(body.owner, body.repo)
        return c.json(result)
      },
    )
    .get(
      "/installed",
      describeRoute({
        summary: "List installed skill repositories",
        description: "Get a list of skill repositories that have been installed.",
        operationId: "skill-installer.installed",
        responses: {
          200: {
            description: "List of installed repos",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string())),
              },
            },
          },
        },
      }),
      async (c) => {
        const result = await Installer.installedRepos()
        return c.json(result)
      },
    ),
)
