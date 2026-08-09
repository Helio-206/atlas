# Sprint 7 Refinement Design QA

## Source visual truth

- Purchase Request reference: `/home/helio/.codex/generated_images/019fe148-db74-7363-9857-968cb1ea9e9b/exec-86afef99-bdf4-4f93-ba12-a2750f2d99a2.png` (`1487 x 1058`).
- Purchase Order reference: `/home/helio/.codex/generated_images/019fe148-db74-7363-9857-968cb1ea9e9b/exec-a788a877-7fc1-4ff6-ad0f-41c53b7f7aa6.png` (`1487 x 1058`).
- Landing reference: `/home/helio/.codex/generated_images/019fe148-db74-7363-9857-968cb1ea9e9b/exec-c6238cf7-9c7c-4d5a-8646-1f68e065af4f.png`.
- User annotation: extend GSAP across the product and make Purchase Requests and Purchase Orders read as restrained paper documents.

## Implementation evidence

- Purchase Request list: `/tmp/atlas-paper-requests.png`.
- Purchase Request detail: `/tmp/atlas-paper-request-detail.png` (`1440 x 1024`).
- New Purchase Request: `/tmp/atlas-paper-request-new.png`.
- Purchase Order list: `/tmp/atlas-paper-orders.png`.
- Purchase Order detail: `/tmp/atlas-paper-order-detail.png` (`1440 x 1024`).
- Landing using the refreshed product captures: `/tmp/atlas-landing-paper-motion.png` (`1440 x 3453`).
- Combined comparisons: `/tmp/atlas-paper-request-comparison.png`, `/tmp/atlas-paper-order-comparison.png`, and `/tmp/atlas-landing-paper-motion-comparison.png`.
- State: authenticated Procurement demo data for operational screens; anonymous visitor for the landing.

## Comparison passes

The initial implementation used the paper treatment only around isolated monetary rows and limited GSAP to broad route/landing entrances. This did not satisfy the annotated target.

The corrected pass applies a shared warm document surface to request/order headers, summaries, forms, item matrices, approvals, receipts, and activity while preserving the approved narrow sidebar, restrained burgundy accent, table density, and low-radius geometry. The effect remains a working document rather than a floating SaaS card.

GSAP now covers shell and sidebar arrival, page headers, active navigation, money values, table rows, viewport section reveals, button/link hover and press feedback, landing header/hero/product frame, structured section staggers, and subtle bounded hero parallax. Reduced-motion removes the animation path. Opacity transitions never toggle semantic visibility after hydration.

The refreshed landing screenshots are direct captures of the same authenticated product implementation, so the public proof and the application no longer diverge.

## Verification

- Side-by-side comparisons were inspected at desktop scale; focused inspection covered header hierarchy, tables, monetary summaries, approvals, document surfaces, and landing product captures.
- No P0, P1, or P2 visual mismatch remains after the annotated refinement.
- Playwright verifies paper surfaces on Purchase Requests and Purchase Orders, active GSAP hover feedback, reduced-motion behavior, and absence of console errors.
- Full browser flow, SQL integration, RLS, lint, TypeScript, 64 unit tests, production build, browser-bundle security check, database reset, and database lint pass.

## Final result

passed
