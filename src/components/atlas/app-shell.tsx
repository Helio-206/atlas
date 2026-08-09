'use client'

import {
  Bell,
  Buildings,
  CaretRight,
  CheckCircle,
  ClipboardText,
  House,
  List,
  Package,
  ShieldCheck,
  SignOut,
  Storefront,
  Users,
  X,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useState } from 'react'

import { logoutAction } from '@/modules/identity/auth/actions'

type Identity = {
  companyName: string
  userName: string
  role: string
  roleKey: string
}

type ShellNotification = {
  id: string
  title: string
  href: string | null
  createdAt: string
  read: boolean
}

type NavItem = {
  href: string
  label: string
  icon: typeof House
  match?: (pathname: string) => boolean
  adminOnly?: boolean
}

const groups: Array<{ label?: string; items: NavItem[] }> = [
  { items: [{ href: '/dashboard', label: 'Visão geral', icon: House, match: (pathname) => pathname === '/dashboard' }] },
  { label: 'Operações', items: [{ href: '/dashboard/projects', label: 'Projetos', icon: Buildings }] },
  {
    label: 'Compras',
    items: [
      { href: '/dashboard/procurement', label: 'Solicitações', icon: ClipboardText },
      { href: '/dashboard/approvals', label: 'Aprovações', icon: CheckCircle },
      { href: '/dashboard/suppliers', label: 'Fornecedores', icon: Storefront },
      { href: '/dashboard/purchase-orders', label: 'Ordens de compra', icon: Package },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/dashboard/users', label: 'Utilizadores', icon: Users, adminOnly: true },
      { href: '/dashboard/audit', label: 'Auditoria', icon: ShieldCheck, adminOnly: true },
    ],
  },
]

export function AppShell({
  children,
  identity,
  notifications,
}: {
  children: ReactNode
  identity: Identity
  notifications: { unreadCount: number; items: ShellNotification[] }
}) {
  const [open, setOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]" data-atlas-shell>
      <button aria-controls="atlas-sidebar" aria-expanded={open} aria-label="Abrir navegação" className="fixed left-4 top-4 z-40 flex size-9 items-center justify-center border border-[var(--border)] bg-[var(--surface)] lg:hidden" onClick={() => setOpen(true)} type="button">
        <List aria-hidden size={18} />
      </button>
      {open ? <button aria-label="Fechar navegação" className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setOpen(false)} type="button" /> : null}
      <Sidebar identity={identity} notifications={notifications} notificationsOpen={notificationsOpen} onClose={() => setOpen(false)} onNotifications={() => setNotificationsOpen((current) => !current)} open={open} />
      <div className="min-h-screen lg:pl-[244px]">
        <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-20 sm:px-8 lg:px-12 lg:pt-10 xl:px-14">{children}</div>
      </div>
    </div>
  )
}

function Sidebar({ identity, notifications, notificationsOpen, onClose, onNotifications, open }: {
  identity: Identity
  notifications: { unreadCount: number; items: ShellNotification[] }
  notificationsOpen: boolean
  onClose: () => void
  onNotifications: () => void
  open: boolean
}) {
  const pathname = usePathname()
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`} id="atlas-sidebar">
      <div className="flex h-[92px] items-center justify-between px-9">
        <Link className="text-[20px] font-semibold tracking-[0.22em]" href="/dashboard" onClick={onClose}>ATLAS</Link>
        <button aria-label="Fechar navegação" className="flex size-8 items-center justify-center text-[var(--text-secondary)] lg:hidden" onClick={onClose} type="button"><X aria-hidden size={18} /></button>
      </div>
      <nav aria-label="Navegação principal" className="atlas-scrollbar flex-1 overflow-y-auto px-5 pb-6">
        {groups.map((group, groupIndex) => (
          <div className={groupIndex === 0 ? '' : 'mt-7'} key={group.label ?? 'overview'}>
            {group.label ? <p className="mb-3 px-4 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--text-muted)]">{group.label}</p> : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.match ? item.match(pathname) : pathname.startsWith(item.href)
                const Icon = item.icon
                const disabled = item.adminOnly && identity.roleKey !== 'administrator'
                if (disabled) return <span aria-disabled="true" className="relative flex min-h-[42px] cursor-not-allowed items-center gap-3 px-4 py-2.5 text-[13px] text-[var(--text-muted)]" key={item.href}><Icon aria-hidden size={17} weight="regular" /><span>{item.label}</span></span>
                return <Link aria-current={active ? 'page' : undefined} className={`relative flex min-h-[42px] items-center gap-3 px-4 py-2.5 text-[13px] ${active ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`} href={item.href} key={item.href} onClick={onClose}>{active ? <span className="absolute -left-5 h-7 w-px bg-[var(--accent)]" /> : null}<Icon aria-hidden size={17} weight="regular" /><span>{item.label}</span></Link>
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="relative mx-5 border-t border-[var(--border)] px-4 py-6">
        {notificationsOpen ? (
          <div className="absolute bottom-[92px] left-0 right-0 border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2"><p className="text-[11px] font-medium">Notificações</p><span className="atlas-tabular text-[10px] text-[var(--text-muted)]">{notifications.unreadCount} não lidas</span></div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.items.length === 0 ? <p className="px-3 py-4 text-[11px] text-[var(--text-muted)]">Sem notificações.</p> : notifications.items.map((item) => {
                const target = item.href ?? '/dashboard'
                return <Link className={`block border-b border-[var(--border)] px-3 py-2.5 text-[11px] leading-4 last:border-b-0 hover:bg-[var(--surface-subtle)] ${item.read ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`} href={`/api/notifications/${item.id}/read?next=${encodeURIComponent(target)}`} key={item.id}><span className="block">{item.title}</span><span className="mt-1 block text-[10px] text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleDateString('pt-PT')}</span></Link>
              })}
            </div>
          </div>
        ) : null}
        <p className="truncate text-[12px] font-semibold">{identity.companyName}</p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-[12px] text-[var(--text-secondary)]">{identity.userName}</p><p className="mt-0.5 truncate text-[11px] capitalize text-[var(--text-muted)]">{identity.role}</p></div>
          <div className="flex items-center gap-1">
            <button aria-expanded={notificationsOpen} aria-label="Notificações" className="relative flex size-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={onNotifications} type="button"><Bell aria-hidden size={16} />{notifications.unreadCount > 0 ? <span className="absolute right-0.5 top-0.5 min-w-3 rounded-full bg-[var(--accent)] px-0.5 text-center text-[8px] leading-3 text-white">{Math.min(notifications.unreadCount, 9)}{notifications.unreadCount > 9 ? '+' : ''}</span> : null}</button>
            <form action={logoutAction}><button aria-label="Terminar sessão" className="flex size-8 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Terminar sessão" type="submit"><SignOut aria-hidden size={16} /></button></form>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function Chevron() { return <CaretRight aria-hidden size={14} /> }
