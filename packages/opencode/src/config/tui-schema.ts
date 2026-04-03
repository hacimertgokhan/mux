import z from "zod"
import { Config } from "./config"
import { LayoutPreset } from "./tui-layout"

const KeybindOverride = z
  .object(
    Object.fromEntries(Object.keys(Config.Keybinds.shape).map((key) => [key, z.string().optional()])) as Record<
      string,
      z.ZodOptional<z.ZodString>
    >,
  )
  .strict()

export const TuiOptions = z.object({
  scroll_speed: z.number().min(0.001).optional().describe("TUI scroll speed"),
  scroll_acceleration: z
    .object({
      enabled: z.boolean().describe("Enable scroll acceleration"),
    })
    .optional()
    .describe("Scroll acceleration settings"),
  diff_style: z
    .enum(["auto", "stacked"])
    .optional()
    .describe("Control diff rendering style: 'auto' adapts to terminal width, 'stacked' always shows single column"),
  sidebar_width: z.number().int().min(24).max(80).optional().describe("Sidebar width in session view"),
  sidebar_breakpoint: z
    .number()
    .int()
    .min(80)
    .max(220)
    .optional()
    .describe("Viewport width where the sidebar switches between docked and overlay modes"),
  sidebar_position: z.enum(["right", "left"]).optional().describe("Sidebar position in session view"),
  home_prompt_width: z.number().int().min(40).max(160).optional().describe("Maximum width of the home prompt area"),
  layout_preset: z
    .enum(LayoutPreset)
    .optional()
    .describe(
      "Layout preset: standard, workspace, focus, modern, soft, minimalist (includes position, width, and session-visibility defaults)",
    ),
  home_prompt_position: z.enum(["center", "bottom"]).optional().describe("Home prompt position"),
  session_prompt_position: z.enum(["bottom", "top"]).optional().describe("Session prompt position"),
  focus_mode: z
    .enum(["default", "zen"])
    .optional()
    .describe("Session focus mode: default keeps current layout, zen starts with distraction-free conversation view"),
})

export const TuiInfo = z
  .object({
    $schema: z.string().optional(),
    theme: z.string().optional(),
    theme_mode: z.enum(["dark", "light"]).optional().describe("Preferred UI mode for themes"),
    theme_mode_lock: z.enum(["dark", "light"]).optional().describe("Lock theme mode and ignore terminal mode changes"),
    keybinds: KeybindOverride.optional(),
    plugin: Config.PluginSpec.array().optional(),
    plugin_enabled: z.record(z.string(), z.boolean()).optional(),
  })
  .extend(TuiOptions.shape)
  .strict()
