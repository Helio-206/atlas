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
      const header = document.querySelectorAll('.landing-header-inner > *')
      const heroCopy = document.querySelectorAll('.landing-hero-copy [data-landing-hero]')
      const heroFrame = document.querySelector<HTMLElement>('.landing-hero > .landing-product-frame')
      const reveal = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-reveal]'))

      const context = gsap.context(() => {
        gsap.fromTo(header, { autoAlpha: 0, y: -7 }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
        gsap.fromTo(heroCopy, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.62, delay: 0.08, stagger: 0.085, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
        if (heroFrame) gsap.fromTo(heroFrame, { autoAlpha: 0, x: 22, scale: 0.985 }, { autoAlpha: 1, x: 0, scale: 1, duration: 0.72, delay: 0.15, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
        gsap.set(reveal, { autoAlpha: 0, y: 20 })
      })

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer?.unobserve(entry.target)
          const target = entry.target as HTMLElement
          const staged = target.querySelectorAll<HTMLElement>('.landing-flow-step, .landing-proof-grid article, .landing-governance-grid > article, .landing-positioning-grid article, .landing-principle, .landing-form .landing-field, .landing-form-actions')
          gsap.to(target, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
          if (staged.length > 0) gsap.fromTo(staged, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.42, delay: 0.09, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' })
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 })

      reveal.forEach((element) => observer?.observe(element))

      const buttons = Array.from(document.querySelectorAll<HTMLElement>('.landing-button'))
      const enter = (event: PointerEvent) => gsap.to(event.currentTarget, { y: -2, duration: 0.16, ease: 'power2.out', overwrite: 'auto' })
      const leave = (event: PointerEvent) => gsap.to(event.currentTarget, { y: 0, scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform' })
      const down = (event: PointerEvent) => gsap.to(event.currentTarget, { scale: 0.985, duration: 0.08, ease: 'power1.out', overwrite: 'auto' })
      const up = (event: PointerEvent) => gsap.to(event.currentTarget, { scale: 1, duration: 0.12, ease: 'power2.out', overwrite: 'auto', clearProps: 'scale' })
      buttons.forEach((button) => {
        button.addEventListener('pointerenter', enter)
        button.addEventListener('pointerleave', leave)
        button.addEventListener('pointerdown', down)
        button.addEventListener('pointerup', up)
      })

      const parallax = () => {
        if (!heroFrame) return
        gsap.to(heroFrame, { y: Math.min(window.scrollY * 0.035, 18), duration: 0.38, ease: 'power1.out', overwrite: 'auto' })
      }
      window.addEventListener('scroll', parallax, { passive: true })

      cleanup = () => {
        window.removeEventListener('scroll', parallax)
        buttons.forEach((button) => {
          button.removeEventListener('pointerenter', enter)
          button.removeEventListener('pointerleave', leave)
          button.removeEventListener('pointerdown', down)
          button.removeEventListener('pointerup', up)
          gsap.killTweensOf(button)
        })
        if (heroFrame) gsap.killTweensOf(heroFrame)
        context.revert()
      }
    })

    return () => {
      disposed = true
      observer?.disconnect()
      cleanup?.()
    }
  }, [])

  return null
}
