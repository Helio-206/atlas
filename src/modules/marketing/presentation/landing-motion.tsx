'use client'

import { useEffect } from 'react'

export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let disposed = false
    let observer: IntersectionObserver | undefined
    let cleanup: (() => void) | undefined

    void import('gsap').then(({ gsap }) => {
      if (disposed) return
      const hero = document.querySelectorAll('[data-landing-hero]')
      const reveal = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-reveal]'))

      const context = gsap.context(() => {
        gsap.fromTo(hero, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.09, ease: 'power2.out' })
        gsap.set(reveal, { autoAlpha: 0, y: 20 })
      })

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer?.unobserve(entry.target)
          gsap.to(entry.target, { autoAlpha: 1, y: 0, duration: 0.58, ease: 'power2.out', clearProps: 'transform' })
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 })

      reveal.forEach((element) => observer?.observe(element))
      cleanup = () => context.revert()
    })

    return () => {
      disposed = true
      observer?.disconnect()
      cleanup?.()
    }
  }, [])

  return null
}
