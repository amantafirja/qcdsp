import type { PurchaseRequest } from '@/types'

export function buildPRCopyText(pr: PurchaseRequest): string {
  const items = pr.items ?? []
  const lines: string[] = [pr.reference_number]

  if (items.length === 1) {
    lines.push(items[0].item_name)
    return lines.join('\n')
  }

  lines.push('')
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.item_name}`)
  })
  return lines.join('\n')
}

export function buildBulkCopyText(requests: PurchaseRequest[]): string {
  return requests
    .map((pr) => {
      const items = pr.items ?? []
      const lines = [pr.reference_number]
      if (items.length === 0) {
        lines.push('- (tanpa item)')
      } else {
        items.forEach((item) => {
          lines.push(`- ${item.item_name}`)
        })
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through ke fallback
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}
