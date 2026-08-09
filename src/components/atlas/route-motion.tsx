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
      const main = document.querySelector('main')
      if (!main) return
      const context = gsap.context(() => {
        gsap.fromTo(main, { autoAlpha: 0.82, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.34, ease: 'power2.out', clearProps: 'transform' })
      })
      cleanup = () => context.revert()
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [pathname])

  return null
}
