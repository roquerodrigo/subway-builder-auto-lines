import { afterEach, describe, expect, it, vi } from 'vitest'

import { Logger, logger } from '@/shared/Logger'

const TAG = '[Test]'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Logger', () => {
  it('tags every log line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    new Logger(TAG).log('mod loaded.')
    expect(log).toHaveBeenCalledWith(TAG, 'mod loaded.')
  })

  it('tags every warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    new Logger(TAG).warn('provisionService', 'went wrong')
    expect(warn).toHaveBeenCalledWith(TAG, 'provisionService', 'went wrong')
  })

  it('tags every error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    new Logger(TAG).error('mod disabled.')
    expect(error).toHaveBeenCalledWith(TAG, 'mod disabled.')
  })

  it('passes through a message with no arguments', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    new Logger(TAG).log()
    expect(log).toHaveBeenCalledWith(TAG)
  })

  // Every message the mod writes has to be greppable under one tag.
  it('tags the shared logger as the mod', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.log('mod loaded.')
    expect(log).toHaveBeenCalledWith('[AutoLines]', 'mod loaded.')
  })
})
