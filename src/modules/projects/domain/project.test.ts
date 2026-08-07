import { describe, expect, it } from 'vitest'

import {
  canActivateProject,
  canCloseProject,
  canEditProject,
  canSuspendProject,
} from './project'

describe('project lifecycle', () => {
  it('activates only draft projects', () => {
    expect(canActivateProject('draft')).toBe(true)
    expect(canActivateProject('active')).toBe(false)
    expect(canActivateProject('suspended')).toBe(false)
    expect(canActivateProject('closed')).toBe(false)
  })

  it('suspends only active projects', () => {
    expect(canSuspendProject('active')).toBe(true)
    expect(canSuspendProject('draft')).toBe(false)
    expect(canSuspendProject('suspended')).toBe(false)
  })

  it('closes active or suspended projects', () => {
    expect(canCloseProject('active')).toBe(true)
    expect(canCloseProject('suspended')).toBe(true)
    expect(canCloseProject('draft')).toBe(false)
  })

  it('keeps closed and cancelled projects immutable', () => {
    expect(canEditProject('draft')).toBe(true)
    expect(canEditProject('active')).toBe(true)
    expect(canEditProject('suspended')).toBe(true)
    expect(canEditProject('closed')).toBe(false)
    expect(canEditProject('cancelled')).toBe(false)
  })
})
