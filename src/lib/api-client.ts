import { useAppStore } from './store'

export function getAuthHeaders(): Record<string, string> {
  const state = useAppStore.getState()
  return {
    'Content-Type': 'application/json',
    'x-user-id': state.user?.id ?? '',
    'x-user-role': state.activeProfile ?? state.user?.role ?? '',
  }
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })
}
