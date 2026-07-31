import { create } from 'zustand'
import { randomId } from '../utils/randomId'

const DEFAULT_DURATION = 7000

export const useToastStore = create((set, get) => ({
  toasts: [],

  add: (toast) => {
    const id = randomId()
    const entry = {
      id,
      type: 'info',
      title: null,
      message: '',
      duration: DEFAULT_DURATION,
      ...toast,
    }
    set({ toasts: [...get().toasts, entry] })

    if (entry.duration > 0) {
      setTimeout(() => get().dismiss(id), entry.duration)
    }
    return id
  },

  dismiss: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  clear: () => set({ toasts: [] }),
}))

export function toast({ type = 'info', title, message, duration }) {
  return useToastStore.getState().add({ type, title, message, duration })
}

export function toastError(message, { title = 'Something went wrong', duration } = {}) {
  return toast({ type: 'error', title, message, duration })
}

export function toastSuccess(message, { title = 'Success', duration = 4000 } = {}) {
  return toast({ type: 'success', title, message, duration })
}

export function toastWarning(message, { title = 'Warning', duration = 6000 } = {}) {
  return toast({ type: 'warning', title, message, duration })
}

/**
 * Show toast from an API error (uses userTitle / userMessage when present).
 */
export function toastFromError(err, { title, context } = {}) {
  const normalized = err?.isApiError ? err : null
  return toastError(normalized?.userMessage ?? err?.message ?? 'Unknown error', {
    title: title ?? normalized?.userTitle ?? 'Error',
  })
}
