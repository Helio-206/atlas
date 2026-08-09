import Link from 'next/link'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const toneColor: Record<Tone, string> = {
  neutral: 'var(--text-muted)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
      {items.map((item, index) => (
        <span className="flex items-center gap-2" key={`${item.label}-${index}`}>
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.href ? <Link className="hover:text-[var(--text-primary)]" href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="border-b border-[var(--border)] pb-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium leading-tight tracking-[-0.025em]">{title}</h1>
          {description ? <div className="mt-1.5 text-[13px] text-[var(--text-secondary)]">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h2>
        {description ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-medium text-[var(--text-secondary)]">
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: toneColor[tone] }} />
      {label}
    </span>
  )
}

export function EntityLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="atlas-link font-medium" href={href}>{children}</Link>
}

export function Money({ value, currency, strong = false }: { value: number; currency: string; strong?: boolean }) {
  const formatted = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
  return <span className={`atlas-money whitespace-nowrap ${strong ? 'font-semibold text-[var(--text-primary)]' : ''}`}>{formatted}</span>
}

export function DataTable({ children, minWidth = 760 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="atlas-scrollbar overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px]" style={{ minWidth }}>{children}</table>
    </div>
  )
}

export function Tabs({ items }: { items: Array<{ label: string; href: string; active?: boolean }> }) {
  return (
    <nav aria-label="Navegação da entidade" className="atlas-scrollbar overflow-x-auto border-b border-[var(--border)]">
      <div className="flex min-w-max gap-8">
        {items.map((item) => (
          <Link
            aria-current={item.active ? 'page' : undefined}
            className={`relative py-3 text-[12px] ${item.active ? 'font-medium text-[var(--text-primary)] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            href={item.href}
            key={item.label}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-5 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-[var(--text-muted)]">{description}</p>
    </div>
  )
}

export function InlineError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-4 text-[var(--danger)]" role="alert">{children}</p>
}

export type ActivityItem = {
  time: string
  text: ReactNode
  href?: string
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <div className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
      {items.map((item, index) => {
        const content = (
          <div className="grid min-h-10 grid-cols-[92px_1fr_auto] items-center gap-4 py-2 text-[12px]">
            <span className="atlas-tabular text-[var(--text-muted)]">{item.time}</span>
            <span className="text-[var(--text-secondary)]">{item.text}</span>
            {item.href ? <span aria-hidden className="text-[var(--text-muted)]">→</span> : null}
          </div>
        )
        return item.href ? <Link className="block hover:bg-[var(--surface-subtle)]" href={item.href} key={index}>{content}</Link> : <div key={index}>{content}</div>
      })}
    </div>
  )
}

export type ApprovalStep = {
  label: string
  detail: string
  meta?: string
  state: 'complete' | 'current' | 'pending'
}

export function ApprovalTimeline({ steps }: { steps: ApprovalStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => (
        <li className="relative grid grid-cols-[20px_1fr] gap-3 pb-5 last:pb-0" key={`${step.label}-${index}`}>
          {index < steps.length - 1 ? <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-[var(--border)]" /> : null}
          <span
            aria-hidden
            className={`relative z-10 mt-1 size-[11px] rounded-full border ${step.state === 'complete' ? 'border-[var(--success)] bg-[var(--success)]' : step.state === 'current' ? 'border-[var(--info)] bg-[var(--info)]' : 'border-[var(--border-strong)] bg-[var(--surface)]'}`}
          />
          <div>
            <p className="text-[12px] font-medium">{step.label}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{step.detail}</p>
            {step.meta ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">{step.meta}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
