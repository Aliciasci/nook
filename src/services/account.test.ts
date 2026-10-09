import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { deleteAccount } from './account'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  invoke.mockReset()
})

describe('deleteAccount', () => {
  it('resolves when the function reports success', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null } as never)
    await expect(deleteAccount()).resolves.toBeUndefined()
    expect(invoke).toHaveBeenCalledWith('delete-account')
  })

  it('throws with the server message when the function reports a business error', async () => {
    invoke.mockResolvedValue({ data: { error: 'Authentification requise.' }, error: null } as never)
    await expect(deleteAccount()).rejects.toThrow('Authentification requise.')
  })

  it('throws a clear message when the function call itself fails (not deployed, network…)', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request') } as never)
    await expect(deleteAccount()).rejects.toThrow(/pas répondu/)
  })

  it('throws a generic message when the response has no ok and no error', async () => {
    invoke.mockResolvedValue({ data: {}, error: null } as never)
    await expect(deleteAccount()).rejects.toThrow('La suppression du compte a échoué.')
  })
})
