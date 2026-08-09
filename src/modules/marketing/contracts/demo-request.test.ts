import { describe, expect, it } from 'vitest'

import { demoRequestSchema } from './demo-request'

const validRequest = {
  name: 'Ana Manuel',
  company: 'Construtora Horizonte, Lda.',
  email: 'ana@horizonte.ao',
  phone: '+244 923 000 000',
  role: 'Diretora Financeira',
  message: 'Pretendemos estruturar o processo de compras.',
}

describe('demo request validation', () => {
  it('accepts a complete business request', () => {
    expect(demoRequestSchema.parse(validRequest)).toEqual(validRequest)
  })

  it('normalizes surrounding whitespace', () => {
    const parsed = demoRequestSchema.parse({ ...validRequest, name: '  Ana Manuel  ', message: '  Piloto  ' })
    expect(parsed.name).toBe('Ana Manuel')
    expect(parsed.message).toBe('Piloto')
  })

  it('rejects invalid email and phone values', () => {
    expect(demoRequestSchema.safeParse({ ...validRequest, email: 'invalid' }).success).toBe(false)
    expect(demoRequestSchema.safeParse({ ...validRequest, phone: '<script>' }).success).toBe(false)
  })

  it('limits optional messages', () => {
    expect(demoRequestSchema.safeParse({ ...validRequest, message: 'a'.repeat(2001) }).success).toBe(false)
  })
})
