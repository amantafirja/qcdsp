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
  'Submitted',
  'Review',
  'Approved',
  'Rejected',
  'Ordered',
  'Received',
  'Closed',
] as const

export type PRStatus = (typeof PR_STATUSES)[number]

export const STATUS_META: Record<
  PRStatus,
  { label: string; description: string; badge: string; dot: string; chart: string }
> = {
  Submitted: {
    label: 'Submitted',
    description: 'Pengajuan diterima sistem dan menunggu review admin.',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    chart: '#94a3b8',
  },
  Review: {
    label: 'Review',
    description: 'Pengajuan sedang diverifikasi oleh tim pengadaan.',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    chart: '#f59e0b',
  },
  Approved: {
    label: 'Approved',
    description: 'Pengajuan disetujui dan siap diproses ke pengadaan.',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    chart: '#10b981',
  },
  Rejected: {
    label: 'Rejected',
    description: 'Pengajuan ditolak. Silakan hubungi tim pengadaan.',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    chart: '#f43f5e',
  },
  Ordered: {
    label: 'Ordered',
    description: 'Purchase order telah dikirim ke vendor.',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    chart: '#3b82f6',
  },
  Received: {
    label: 'Received',
    description: 'Barang sudah diterima dan diverifikasi.',
    badge: 'border-teal-200 bg-teal-50 text-teal-700',
    dot: 'bg-teal-500',
    chart: '#14b8a6',
  },
  Closed: {
    label: 'Closed',
    description: 'Pengajuan selesai dan ditutup.',
    badge: 'border-navy-200 bg-navy-50 text-navy-700',
    dot: 'bg-navy-500',
    chart: '#355384',
  },
}

export const STATUS_FLOW: PRStatus[] = [
  'Submitted',
  'Review',
  'Approved',
  'Ordered',
  'Received',
  'Closed',
]

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
