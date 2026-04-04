import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mux - Multi-key Routing for OpenCode",
  description: "Smart routing layer for OpenCode with OpenRouter. Never hit a rate limit again.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
