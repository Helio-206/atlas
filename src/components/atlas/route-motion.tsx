'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function RouteMotion() {
  const pathname = usePathname()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let disposed = false
    let cleanup: (() => void) | undefined

    void import('gsap').then(({ gsap }) => {
      if (disposed) return
      const main = document.querySelector<HTMLElement>('main')
      if (!main) return
      const shell = document.querySelector<HTMLElement>('[data-atlas-shell]')
      const observed = new Set<HTMLElement>()
      const interactive = new Set<HTMLElement>()
      let observer: IntersectionObserver | undefined

      const context = gsap.context(() => {
        gsap.fromTo(main, { autoAlpha: 0.76, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
        if (!shell) return

        const sidebar = document.querySelector<HTMLElement>('[data-atlas-sidebar]')
        if (sidebar && window.matchMedia('(min-width: 1024px)').matches) {
          gsap.fromTo(sidebar, { autoAlpha: 0.86, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.48, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
        }

        const header = main.querySelector<HTMLElement>('[data-atlas-motion="header"]')
        if (header) gsap.fromTo(header, { opacity: 0.24, y: 12 }, { opacity: 1, y: 0, duration: 0.48, delay: 0.05, ease: 'power2.out', clearProps: 'transform,opacity' })

        const active = document.querySelectorAll<HTMLElement>('[data-atlas-active]')
        gsap.fromTo(active, { autoAlpha: 0.55, x: -4 }, { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })

        const money = main.querySelectorAll<HTMLElement>('[data-atlas-money]')
        gsap.fromTo(money, { opacity: 0.3, y: 5 }, { opacity: 1, y: 0, duration: 0.34, delay: 0.12, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity' })

        const rows = main.querySelectorAll<HTMLElement>('[data-atlas-table] tbody tr')
        gsap.fromTo(rows, { opacity: 0.22, y: 6 }, { opacity: 1, y: 0, duration: 0.32, delay: 0.14, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity' })

        const reveals = Array.from(main.querySelectorAll<HTMLElement>(':scope > section, :scope > [data-atlas-motion], :scope > div > [data-atlas-motion]'))
          .filter((element) => element !== header)
        const immediate = reveals.filter((element) => element.getBoundingClientRect().top < window.innerHeight * 0.94)
        const deferred = reveals.filter((element) => !immediate.includes(element))

        gsap.fromTo(immediate, { opacity: 0.2, y: 12 }, { opacity: 1, y: 0, duration: 0.42, delay: 0.09, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity' })
        gsap.set(deferred, { opacity: 0.2, y: 14 })

        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const element = entry.target as HTMLElement
            observer?.unobserve(element)
            observed.delete(element)
            gsap.to(element, { opacity: 1, y: 0, duration: 0.44, ease: 'power2.out', clearProps: 'transform,opacity' })
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
        deferred.forEach((element) => {
          observed.add(element)
          observer?.observe(element)
        })
      })

      const selector = '.atlas-button, [data-atlas-motion-link]'
      const targetFrom = (event: PointerEvent) => (event.target as Element | null)?.closest<HTMLElement>(selector) ?? null
      const enter = (event: PointerEvent) => {
        const target = targetFrom(event)
        if (!target || target.contains(event.relatedTarget as Node | null)) return
        interactive.add(target)
        gsap.to(target, { y: -1.5, duration: 0.16, ease: 'power2.out', overwrite: 'auto' })
      }
      const leave = (event: PointerEvent) => {
        const target = targetFrom(event)
        if (!target || target.contains(event.relatedTarget as Node | null)) return
        gsap.to(target, { y: 0, scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' })
      }
      const down = (event: PointerEvent) => {
        const target = targetFrom(event)
        if (!target) return
        interactive.add(target)
        gsap.to(target, { scale: 0.985, duration: 0.09, ease: 'power1.out', overwrite: 'auto' })
      }
      const up = (event: PointerEvent) => {
        const target = targetFrom(event)
        if (!target) return
        gsap.to(target, { scale: 1, duration: 0.14, ease: 'power2.out', overwrite: 'auto', clearProps: 'scale' })
      }

      document.addEventListener('pointerover', enter)
      document.addEventListener('pointerout', leave)
      document.addEventListener('pointerdown', down)
      document.addEventListener('pointerup', up)

      cleanup = () => {
        observer?.disconnect()
        observed.clear()
        document.removeEventListener('pointerover', enter)
        document.removeEventListener('pointerout', leave)
        document.removeEventListener('pointerdown', down)
        document.removeEventListener('pointerup', up)
        interactive.forEach((element) => gsap.killTweensOf(element))
        context.revert()
      }
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [pathname])

  return null
}
