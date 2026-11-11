import type { ReactNode } from "react"
import Link from "next/link"
import { Blocks, MoveLeft } from "lucide-react"

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="account-page">
      <section className="account-panel" aria-labelledby="account-title">
        <Link className="account-brand" href="/" aria-label="VitalCraft home">
          <span className="brand-cube"><Blocks size={18} strokeWidth={2.5} /></span>
          <span className="brand-name">VITAL<span>CRAFT</span></span>
          <span className="brand-edition">’26</span>
        </Link>
        <p className="account-eyebrow">{eyebrow}</p>
        <h1 id="account-title">{title}</h1>
        <p className="account-description">{description}</p>
        {children}
        <Link className="account-back" href="/">
          <MoveLeft size={14} aria-hidden="true" /> Back to the event
        </Link>
      </section>
    </main>
  )
}
