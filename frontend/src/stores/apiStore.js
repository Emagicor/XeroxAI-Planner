import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:5000'

export const useApiStore = create(
  persist(
    (set, get) => ({
      apiBaseUrl: DEFAULT_BASE_URL,

      setApiBaseUrl: (url) =>
        set({ apiBaseUrl: (url || DEFAULT_BASE_URL).replace(/\/$/, '') }),

      clearApiConfig: () =>
        set({
          apiBaseUrl: DEFAULT_BASE_URL,
        }),

      getAnalyzeEndpoint: () => `${get().apiBaseUrl}/analyze`,
    }),
    {
      name: 'floor-plan-api-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        apiBaseUrl: state.apiBaseUrl,
      }),
    },
  ),
)
