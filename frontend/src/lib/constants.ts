export const ORDER_TYPES = [
  'Reagen',
  'Tools',
  'Expense Item',
  'Reagen Mikro',
  'Tools Mikro',
  'RS/Reference Standard',
  'Gas',
  'Analisa External',
  'Lain-Lain',
] as const

export type OrderType = (typeof ORDER_TYPES)[number]

export const PR_STATUSES = [
  'form_created',
  'op_penawaran',
  'op_proposal',
  'op_manager',
  'pending_po',
  'po_approve',
  'done',
  'rejected',
  'cancelled',
] as const

export type PRStatus = (typeof PR_STATUSES)[number]

export const STATUS_META: Record<
  PRStatus,
  { label: string; short: string; description: string; badge: string; dot: string; chart: string }
> = {
  form_created: {
    label: 'Form Dibuat',
    short: 'Form Dibuat',
    description: 'Purchase Request dibuat dan menunggu proses purchasing.',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    chart: '#94a3b8',
  },
  op_penawaran: {
    label: 'OP Penawaran Purchasing',
    short: 'Penawaran',
    description: 'Purchasing sedang memproses permintaan penawaran ke vendor.',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    chart: '#f59e0b',
  },
  op_proposal: {
    label: 'OP Proposal',
    short: 'Proposal',
    description: 'Proposal penawaran sedang disusun.',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
    chart: '#8b5cf6',
  },
  op_manager: {
    label: 'OP Manager',
    short: 'OP Manager',
    description: 'Proposal menunggu persetujuan manager.',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    dot: 'bg-indigo-500',
    chart: '#6366f1',
  },
  pending_po: {
    label: 'Pending PO',
    short: 'Pending PO',
    description: 'Menunggu penerbitan Purchase Order.',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    chart: '#3b82f6',
  },
  po_approve: {
    label: 'PO Approve',
    short: 'PO Approve',
    description: 'Purchase Order telah disetujui dan diproses ke vendor.',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    chart: '#0ea5e9',
  },
  done: {
    label: 'Selesai (Done)',
    short: 'Selesai',
    description: 'Pengadaan selesai dan barang sudah diterima.',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    chart: '#10b981',
  },
  rejected: {
    label: 'Selesai (Reject)',
    short: 'Reject',
    description: 'Pengajuan ditolak dan proses dihentikan.',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    chart: '#f43f5e',
  },
  cancelled: {
    label: 'Selesai (Cancel)',
    short: 'Cancel',
    description: 'Pengajuan dibatalkan dan proses dihentikan.',
    badge: 'border-navy-200 bg-navy-50 text-navy-700',
    dot: 'bg-navy-500',
    chart: '#64748b',
  },
}

export const STATUS_FLOW: PRStatus[] = [
  'form_created',
  'op_penawaran',
  'op_proposal',
  'op_manager',
  'pending_po',
  'po_approve',
]

export const TERMINAL_STATUSES: PRStatus[] = ['done', 'rejected', 'cancelled']

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as string[]).includes(status)
}

export function statusLabel(status: string): string {
  return STATUS_META[status as PRStatus]?.label ?? status
}

export const CONTENT_TYPE_META = {
  pdf: {
    label: 'PDF',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: 'pdf',
  },
  article: {
    label: 'Artikel',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    icon: 'article',
  },
} as const

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.jpg', '.jpeg', '.png']
export const ALLOWED_SPV_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png']
