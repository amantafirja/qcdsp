import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value)
}

export function formatDate(value?: string | Date | null, pattern = 'dd MMM yyyy'): string {
  if (!value) return '-'
  try {
    return format(toDate(value), pattern, { locale: localeId })
  } catch {
    return '-'
  }
}

export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, 'dd MMM yyyy, HH:mm')
}

export function formatRelative(value?: string | Date | null): string {
  if (!value) return '-'
  try {
    return formatDistanceToNow(toDate(value), { addSuffix: true, locale: localeId })
  } catch {
    return '-'
  }
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatNumber(value?: number | null): string {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat('id-ID').format(value)
}

export function getInitials(name?: string): string {
  if (!name) return 'QC'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

export function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(value: string, length = 160): string {
  if (!value) return ''
  if (value.length <= length) return value
  return `${value.slice(0, length).trimEnd()}...`
}
