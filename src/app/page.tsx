import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DemoRequestForm } from '@/modules/marketing/presentation/demo-request-form'
import { LandingMotion } from '@/modules/marketing/presentation/landing-motion'

import './landing.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Atlas — Operações empresariais, estruturadas',
  description: 'O Atlas transforma processos empresariais em fluxos claros, controlados e rastreáveis — da solicitação à execução e auditoria.',
  openGraph: {
    title: 'Atlas — Operações empresariais, estruturadas',
    description: 'O Atlas transforma processos empresariais em fluxos claros, controlados e rastreáveis — da solicitação à execução e auditoria.',
    type: 'website',
    images: [{ url: '/landing/purchase-request-detail.png', width: 1440, height: 1024, alt: 'Detalhe de uma solicitação de compra no Atlas' }],
  },
}

const flow = ['Solicitação', 'Aprovação', 'Cotações', 'Comparação', 'Fornecedor', 'Ordem de compra', 'Receção', 'Auditoria']

const proofs = [
  {
    title: 'Contexto suficiente para decidir.',
    description: 'Detalhe completo da solicitação, itens, valores, aprovações e histórico num só lugar.',
    image: '/landing/purchase-request-detail.png',
    alt: 'Detalhe completo de uma solicitação de compra no Atlas',
  },
  {
    title: 'Compare antes de decidir.',
    description: 'Preço, prazo, cobertura, condições e moeda, com seleção humana e justificação.',
    image: '/landing/supplier-comparison.png',
    alt: 'Comparação de fornecedores com preço, prazo, cobertura, condições e moeda no Atlas',
  },
  {
    title: 'Acompanhe até à execução.',
    description: 'Ordem, itens, receções, progresso e estado preservados no mesmo processo.',
    image: '/landing/purchase-order-detail.png',
    alt: 'Ordem de compra com itens, receções, progresso e estado no Atlas',
  },
]

const security = ['Isolamento por empresa', 'Permissões por função', 'Auditoria', 'Documentos privados', 'Autenticação', 'Histórico de decisões']

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getClaims()

  if (!error && data?.claims) redirect('/dashboard')

  const contactEmail = process.env.NEXT_PUBLIC_ATLAS_CONTACT_EMAIL?.trim()
  const contactHref = contactEmail ? `mailto:${contactEmail}` : '#demo'

  return (
    <main className="landing-page">
      <LandingMotion />
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link aria-label="Atlas — página inicial" className="landing-wordmark" href="/">ATLAS</Link>
          <nav aria-label="Navegação principal" className="landing-nav">
            <a href="#produto">Produto</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#procurement">Procurement</a>
            <a href="#seguranca">Segurança</a>
          </nav>
          <div className="landing-header-actions">
            <Link className="landing-button" href="/login">Entrar</Link>
            <a className="landing-button landing-button-primary" href="#demo">Solicitar demonstração</a>
          </div>
          <details className="landing-mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Navegação móvel">
              <a href="#produto">Produto</a><a href="#como-funciona">Como funciona</a><a href="#procurement">Procurement</a><a href="#seguranca">Segurança</a><Link href="/login">Entrar</Link><a href="#demo">Solicitar demonstração</a>
            </nav>
          </details>
        </div>
      </header>

      <section className="landing-container landing-hero" id="produto">
        <div className="landing-hero-copy">
          <p className="landing-kicker" data-landing-hero>OPERAÇÕES EMPRESARIAIS, ESTRUTURADAS.</p>
          <h1 data-landing-hero>A sua operação não deveria depender de informação espalhada.</h1>
          <p data-landing-hero>O Atlas transforma processos empresariais em fluxos claros, controlados e rastreáveis — das solicitações e aprovações à execução e auditoria.</p>
          <div className="landing-hero-actions" data-landing-hero>
            <a className="landing-button landing-button-primary" href="#demo">Solicitar demonstração</a>
            <a className="landing-button" href="#como-funciona">Ver como funciona</a>
          </div>
        </div>
        <div className="landing-product-frame" data-landing-hero>
          <Image alt="Purchase Request Detail no Atlas" fetchPriority="high" height={1024} loading="eager" sizes="(max-width: 900px) calc(100vw - 40px), 61vw" src="/landing/purchase-request-detail.png" width={1440} />
        </div>
      </section>

      <section className="landing-section landing-section-white landing-section-compact" id="como-funciona">
        <div className="landing-container landing-problem-difference" data-landing-reveal>
          <article>
            <p className="landing-kicker">1. O PROBLEMA</p>
            <h2>Quando a operação cresce,<br />a informação fragmenta-se.</h2>
            <div className="landing-fragmentation" aria-label="Fontes de informação fragmentada">
              {['Excel', 'WhatsApp', 'Email', 'Papel', 'Sistemas isolados'].map((item) => <span key={item}>{item}</span>)}
            </div>
            <p className="landing-supporting">Cada ferramenta resolve uma parte. O processo vive entre todas elas.</p>
            <div className="landing-consequences">
              <strong>Consequências comuns</strong>
              <ul><li>Aprovações difíceis de acompanhar</li><li>Decisões sem contexto</li><li>Informação duplicada</li><li>Pouca rastreabilidade</li><li>Dependência de pessoas específicas</li></ul>
            </div>
          </article>
          <article>
            <p className="landing-kicker">2. A DIFERENÇA</p>
            <h2>Não organizamos apenas tarefas.<br />Estruturamos processos.</h2>
            <div className="landing-comparison">
              <div><strong>Ferramenta genérica</strong><span>Ticket</span><span>Status</span><span>Assignee</span><span>Done</span></div>
              <span aria-hidden className="landing-comparison-arrow">→</span>
              <div><strong>Atlas</strong><span>Solicitação</span><span>Aprovação</span><span>Cotação</span><span>Decisão</span><span>Ordem</span><span>Receção</span><span>Auditoria</span></div>
            </div>
            <p className="landing-supporting">O Atlas conhece as entidades, decisões e regras que fazem parte da operação.</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-section-compact" id="procurement">
        <div className="landing-container" data-landing-reveal>
          <p className="landing-kicker">3. O FLUXO DE PROCUREMENT</p>
          <h2 className="landing-band-title">Do pedido à receção. Um único processo.</h2>
          <div aria-label="Fluxo de Procurement" className="landing-flow landing-flow-eight">
            {flow.map((step, index) => <div className="landing-flow-step" key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}
          </div>
          <p className="landing-band-note">Procurement é o primeiro módulo operacional do Atlas.</p>
        </div>
      </section>

      <section className="landing-section landing-section-white landing-section-compact">
        <div className="landing-container" data-landing-reveal>
          <p className="landing-kicker">4. PROVA NO PRODUTO</p>
          <div className="landing-proof-grid">
            {proofs.map((proof) => (
              <article key={proof.title}>
                <div className="landing-product-frame"><Image alt={proof.alt} height={1024} loading="lazy" sizes="(max-width: 620px) calc(100vw - 32px), 32vw" src={proof.image} width={1440} /></div>
                <h3>{proof.title}</h3>
                <p>{proof.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-compact" id="seguranca">
        <div className="landing-container landing-governance-grid" data-landing-reveal>
          <article>
            <p className="landing-kicker">5. RASTREABILIDADE</p>
            <h2>Cada decisão deixa contexto.</h2>
            <div className="landing-audit-head"><span>Quem</span><span>O quê</span><span>Quando</span><span>Porquê</span></div>
            <AuditRow who="Ana Almeida" what="Criou a solicitação" when="09/08/2026" why="Necessidade da obra" />
            <AuditRow who="Carlos Mendes" what="Aprovou" when="09/08/2026" why="Orçamento disponível" />
            <AuditRow who="João Pereira" what="Selecionou fornecedor" when="09/08/2026" why="Melhor equilíbrio" />
            <p className="landing-supporting">Aprovações, seleção de fornecedores, ordens e receções permanecem ligadas à sua origem.</p>
          </article>
          <article>
            <p className="landing-kicker">6. SEGURANÇA E CONTROLO</p>
            <h2>Construído para operações empresariais.</h2>
            <ul className="landing-security-checks">{security.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article>
            <p className="landing-kicker">7. ADAPTÁVEL À SUA REALIDADE</p>
            <h2>O processo é da empresa.<br />O Atlas fornece a estrutura.</h2>
            <div className="landing-rules" aria-label="Exemplo de regra de aprovação">
              <div><span>&lt; 5M Kz</span><span>Financeiro</span><span>→ Approved</span></div>
              <div><span>≥ 5M Kz</span><span>Financeiro</span><span>→ Direção → Approved</span></div>
            </div>
            <p className="landing-supporting">As regras refletem a governação da empresa.</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-section-white landing-positioning-band">
        <div className="landing-container" data-landing-reveal>
          <p className="landing-kicker">8. POSICIONAMENTO</p>
          <div className="landing-positioning-grid">
            <article><span aria-hidden className="landing-module-mark">01</span><div><h2>Procurement — Disponível</h2><p>Solicitações, aprovações, cotações, comparação, ordens de compra, receções e auditoria.</p></div></article>
            <article className="landing-future-module"><span aria-hidden className="landing-module-mark">···</span><div><h2>Outros processos — Futuro</h2><p>Novos módulos operacionais serão disponibilizados de forma faseada.</p></div></article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-cta-section" id="demo">
        <div className="landing-container landing-cta" data-landing-reveal>
          <div className="landing-cta-copy">
            <p className="landing-kicker">9. PRÓXIMO PASSO</p>
            <h2>Veja o Atlas aplicado a uma operação real.</h2>
            <p>Empresas estruturam processos, ganham visibilidade e reduzem fragmentação. Solicite uma demonstração com base na sua realidade.</p>
            <div className="landing-cta-actions"><a className="landing-text-link" href={contactHref}>Falar connosco →</a></div>
          </div>
          <DemoRequestForm />
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner"><div><span className="landing-wordmark">ATLAS</span><p>Operações empresariais, estruturadas.</p></div><nav aria-label="Rodapé"><a href="#produto">Produto</a><a href="#procurement">Procurement</a><a href="#seguranca">Segurança</a><a href={contactHref}>Contacto</a></nav></div>
      </footer>
    </main>
  )
}

function AuditRow({ who, what, when, why }: { who: string; what: string; when: string; why: string }) {
  return <div className="landing-audit-row"><span>{who}</span><span>{what}</span><time>{when}</time><span>{why}</span></div>
}
