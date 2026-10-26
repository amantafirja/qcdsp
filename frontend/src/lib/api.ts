import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { ApiError, type ApiResponse } from '@/types'

const TOKEN_KEY = 'qcdsp_token'
const ADMIN_KEY = 'qcdsp_admin'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_KEY)
  },
  getAdmin<T>(): T | null {
    try {
      const raw = localStorage.getItem(ADMIN_KEY)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  setAdmin(admin: unknown) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
  },
}

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60_000,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 && !error.config?.url?.includes('/admin/login')) {
        tokenStorage.clear()
        if (!window.location.pathname.startsWith('/admin/login')) {
          const redirect = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.href = `/admin/login?redirect=${redirect}`
        }
      }

      const body = error.response?.data as ApiResponse<unknown> | undefined
      const message =
        body?.message ||
        (error.code === 'ECONNABORTED'
          ? 'Permintaan melebihi batas waktu. Silakan coba lagi.'
          : error.response
            ? 'Terjadi kesalahan pada server.'
            : 'Tidak dapat terhubung ke server. Pastikan backend berjalan.')

      return Promise.reject(new ApiError(message, error.response?.status ?? 0, body?.errors ?? null))
    }
    return Promise.reject(error)
  },
)

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.get<ApiResponse<T>>(url, config)
  return response.data
}

export async function apiPost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.post<ApiResponse<T>>(url, data, config)
  return response.data
}

export async function apiPut<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.put<ApiResponse<T>>(url, data, config)
  return response.data
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.delete<ApiResponse<T>>(url, config)
  return response.data
}

export function resolveApiUrl(path?: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/api')) return `${API_BASE_URL}${path}`
  return path
}

export async function downloadFile(url: string, filename?: string) {
  const response = await api.get(url, { responseType: 'blob' })
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename || 'download'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(blobUrl)
}

function normalizeApiPath(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/api/')) return url.slice(4)
  return url
}

export async function downloadProtectedFile(url: string, filename?: string) {
  const response = await api.get(normalizeApiPath(url), { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] as string | undefined
  let resolvedName = filename
  if (!resolvedName && disposition) {
    const match = /filename="?([^";]+)"?/i.exec(disposition)
    if (match?.[1]) resolvedName = decodeURIComponent(match[1])
  }
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = resolvedName || 'lampiran'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export async function openProtectedFile(url: string) {
  const response = await api.get(normalizeApiPath(url), { responseType: 'blob' })
  const blobUrl = window.URL.createObjectURL(
    new Blob([response.data], { type: response.headers['content-type'] as string }),
  )
  window.open(blobUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
}
