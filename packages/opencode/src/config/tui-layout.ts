export const LayoutPreset = ["standard", "workspace", "focus", "modern", "soft", "minimalist"] as const

export type LayoutPreset = (typeof LayoutPreset)[number]

export const LayoutMap = {
  standard: {
    sidebar_position: "right",
    home_prompt_position: "center",
    session_prompt_position: "bottom",
    focus_mode: "default",
    sidebar: "auto",
    sidebar_width: 42,
    sidebar_breakpoint: 120,
    home_prompt_width: 75,
    thinking_visibility: true,
    tool_details_visibility: true,
    assistant_metadata_visibility: true,
    scrollbar_visible: true,
    animations_enabled: true,
  },
  workspace: {
    sidebar_position: "left",
    home_prompt_position: "bottom",
    session_prompt_position: "bottom",
    focus_mode: "default",
    sidebar: "auto",
    sidebar_width: 46,
    sidebar_breakpoint: 118,
    home_prompt_width: 84,
    thinking_visibility: true,
    tool_details_visibility: true,
    assistant_metadata_visibility: true,
    scrollbar_visible: true,
    animations_enabled: true,
  },
  focus: {
    sidebar_position: "left",
    home_prompt_position: "bottom",
    session_prompt_position: "top",
    focus_mode: "zen",
    sidebar: "hide",
    sidebar_width: 40,
    sidebar_breakpoint: 120,
    home_prompt_width: 80,
    thinking_visibility: true,
    tool_details_visibility: true,
    assistant_metadata_visibility: true,
    scrollbar_visible: true,
    animations_enabled: true,
  },
  modern: {
    sidebar_position: "right",
    home_prompt_position: "bottom",
    session_prompt_position: "bottom",
    focus_mode: "default",
    sidebar: "auto",
    sidebar_width: 36,
    sidebar_breakpoint: 110,
    home_prompt_width: 96,
    thinking_visibility: true,
    tool_details_visibility: true,
    assistant_metadata_visibility: true,
    scrollbar_visible: true,
    animations_enabled: true,
  },
  soft: {
    sidebar_position: "right",
    home_prompt_position: "center",
    session_prompt_position: "bottom",
    focus_mode: "default",
    sidebar: "auto",
    sidebar_width: 44,
    sidebar_breakpoint: 126,
    home_prompt_width: 104,
    thinking_visibility: true,
    tool_details_visibility: true,
    assistant_metadata_visibility: true,
    scrollbar_visible: true,
    animations_enabled: true,
  },
  minimalist: {
    sidebar_position: "right",
    home_prompt_position: "bottom",
    session_prompt_position: "top",
    focus_mode: "zen",
    sidebar: "hide",
    sidebar_width: 30,
    sidebar_breakpoint: 140,
    home_prompt_width: 62,
    thinking_visibility: false,
    tool_details_visibility: false,
    assistant_metadata_visibility: false,
    scrollbar_visible: false,
    animations_enabled: false,
  },
} as const satisfies Record<
  LayoutPreset,
  {
    sidebar_position: "right" | "left"
    home_prompt_position: "center" | "bottom"
    session_prompt_position: "bottom" | "top"
    focus_mode: "default" | "zen"
    sidebar: "auto" | "hide"
    sidebar_width: number
    sidebar_breakpoint: number
    home_prompt_width: number
    thinking_visibility: boolean
    tool_details_visibility: boolean
    assistant_metadata_visibility: boolean
    scrollbar_visible: boolean
    animations_enabled: boolean
  }
>

export function layout(value?: string): LayoutPreset {
  if (!value) return "standard"
  if ((LayoutPreset as readonly string[]).includes(value)) return value as LayoutPreset
  return "standard"
}
