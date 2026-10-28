import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  ClipboardList,
  Clock3,
  FileText,
  GitMerge,
  Layers,
  Truck,
} from 'lucide-react'
import { useDashboard } from '@/hooks/use-api'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { ErrorState } from '@/components/shared/empty-state'
import { formatDate, formatNumber } from '@/lib/format'
import { STATUS_META, type PRStatus } from '@/lib/constants'
import { cn } from '@/lib/utils'

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatMonth(value: string): string {
  const [year, month] = value.split('-')
  const index = Number(month) - 1
  return `${monthNames[index] ?? month} ${year?.slice(2) ?? ''}`
}

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { data, isLoading, isError, refetch } = useDashboard()

  const monthlyData = useMemo(
    () =>
      (data?.monthly_pr ?? []).map((item) => ({
        month: formatMonth(item.month),
        total: item.count,
      })),
    [data?.monthly_pr],
  )

  const statusData = useMemo(
    () =>
      (data?.status_distribution ?? [])
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: item.label,
          value: item.count,
          color: STATUS_META[item.label as PRStatus]?.chart ?? '#94a3b8',
        })),
    [data?.status_distribution],
  )

  const typeData = useMemo(
    () =>
      (data?.order_type_distribution ?? []).map((item) => ({
        name: item.label,
        total: item.count,
      })),
    [data?.order_type_distribution],
  )

  if (isError) {
    return <ErrorState message="Gagal memuat data dashboard." onRetry={() => void refetch()} />
  }

  const stats = data?.stats

  const statCards = [
    {
      label: 'Total Open PR',
      value: stats?.total_open ?? 0,
      icon: ClipboardList,
      tone: 'bg-primary-50 text-primary-700',
      hint: 'PR yang masih berjalan',
      to: '/admin/purchase-requests',
    },
    {
      label: 'Pending Approval',
      value: stats?.total_pending_approval ?? 0,
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-700',
      hint: 'Menunggu persetujuan manager',
      to: '/admin/purchase-requests?status=op_manager',
    },
    {
      label: 'Total Approved PR',
      value: stats?.total_approved ?? 0,
      icon: BadgeCheck,
      tone: 'bg-emerald-50 text-emerald-700',
      hint: 'PO disetujui atau selesai',
      to: '/admin/purchase-requests',
    },
    {
      label: 'Outstanding Delivery',
      value: stats?.total_outstanding_delivery ?? 0,
      icon: Truck,
      tone: 'bg-sky-50 text-sky-700',
      hint: 'PO disetujui, belum diterima',
      to: '/admin/purchase-requests?status=po_approve',
    },
    {
      label: 'Total Closed PR',
      value: stats?.total_closed ?? 0,
      icon: Archive,
      tone: 'bg-navy-100 text-navy-700',
      hint: 'Done, reject, atau cancel',
      to: '/admin/purchase-requests',
    },
  ]

  const knowledgeCards = [
    {
      label: 'Total Dokumen',
      value: stats?.total_documents ?? 0,
      icon: BookOpen,
      tone: 'bg-primary-50 text-primary-700',
      hint: 'Seluruh konten Knowledge Center',
    },
    {
      label: 'Total Artikel',
      value: stats?.total_articles ?? 0,
      icon: FileText,
      tone: 'bg-sky-50 text-sky-700',
      hint: 'Konten rich text',
    },
    {
      label: 'Total PDF',
      value: stats?.total_pdf ?? 0,
      icon: Layers,
      tone: 'bg-rose-50 text-rose-700',
      hint: 'Dokumen PDF terunggah',
    },
    {
      label: 'PR Digabung',
      value: stats?.total_merged ?? 0,
      icon: GitMerge,
      tone: 'bg-violet-50 text-violet-700',
      hint: 'PR asal yang tergabung ke PR Utama',
    },
  ]

  const prStatusCards = (data?.status_distribution ?? []).map((item) => ({
    status: item.label,
    label: STATUS_META[item.label as PRStatus]?.label ?? item.label,
    value: item.count,
    color: STATUS_META[item.label as PRStatus]?.badge ?? 'border-navy-200 bg-navy-50 text-navy-700',
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">Ringkasan Operasional</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Statistik dokumen dan Purchase Request laboratorium QC.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/knowledge/new">
              <FileText className="h-3.5 w-3.5" />
              Tambah dokumen
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/purchase-requests">
              <ClipboardList className="h-3.5 w-3.5" />
              Kelola PR
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="stat-card group transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-elevated"
          >
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', card.tone)}>
              <card.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-medium text-navy-500">{card.label}</p>
            {isLoading ? (
              <div className="skeleton mt-2 h-9 w-20" />
            ) : (
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-navy-900 sm:text-4xl">
                {formatNumber(card.value)}
              </p>
            )}
            <p className="mt-2 text-sm text-navy-400">{card.hint}</p>
          </Link>
        ))}
      </div>

      <div className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Status Purchase Request</h3>
          <Link
            to="/admin/purchase-requests"
            className="text-sm font-medium text-primary-700 hover:underline"
          >
            Lihat semua PR
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {prStatusCards.map((card) => (
            <Link
              key={card.status}
              to={`/admin/purchase-requests?status=${card.status}`}
              className="flex items-center gap-3 rounded-xl border border-transparent bg-navy-50/60 p-3.5 transition-colors hover:border-primary-200 hover:bg-white"
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', card.color)}>
                <ClipboardList className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy-500">{card.label}</p>
                {isLoading ? (
                  <div className="skeleton mt-1 h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold leading-tight tabular-nums text-navy-900">
                    {formatNumber(card.value)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {knowledgeCards.map((card) => (
          <div key={card.label} className="surface-card flex items-center gap-3 p-4">
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', card.tone)}>
              <card.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy-500">{card.label}</p>
              <p className="text-xl font-bold tabular-nums text-navy-900">{formatNumber(card.value)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="section-title">Purchase Request per Bulan</h3>
              <p className="mt-1 text-sm text-muted-foreground">12 bulan terakhir</p>
            </div>
            <Badge variant="secondary">{monthlyData.reduce((sum, item) => sum + item.total, 0)} PR</Badge>
          </div>
          <div className="mt-4 h-[280px] w-full">
            {isLoading ? (
              <div className="skeleton h-full w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="prGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      boxShadow: '0 8px 24px -12px rgba(15,37,71,.25)',
                    }}
                    labelStyle={{ fontWeight: 600, color: '#0f2547' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Purchase Request"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#prGradient)"
                    dot={{ r: 2.5, fill: '#2563eb', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card p-5">
          <h3 className="section-title">Distribusi Status</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Proporsi PR per status</p>
          <div className="mt-2 h-[280px] w-full">
            {isLoading ? (
              <div className="skeleton h-full w-full rounded-lg" />
            ) : statusData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Belum ada data Purchase Request
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={2}
                    stroke="#ffffff"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 11, color: '#475569' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5">
          <h3 className="section-title">Distribusi Jenis Pemesanan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Berdasarkan seluruh PR yang masuk</p>
          <div className="mt-4 h-[300px] w-full">
            {isLoading ? (
              <div className="skeleton h-full w-full rounded-lg" />
            ) : typeData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Belum ada data jenis pemesanan
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={132}
                    tick={{ fontSize: 10, fill: '#334155' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    cursor={{ fill: 'rgba(37,99,235,0.05)' }}
                  />
                  <Bar dataKey="total" name="Jumlah PR" fill="#355384" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-title">Purchase Request Terbaru</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">5 pengajuan terakhir</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/purchase-requests">
                Semua
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-navy-100 p-3">
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton mt-2 h-4 w-3/4" />
                </div>
              ))}

            {!isLoading && (data?.recent_purchase_requests ?? []).length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Belum ada Purchase Request.</p>
            )}

            {(data?.recent_purchase_requests ?? []).map((pr) => (
              <Link
                key={pr.id}
                to={`/admin/purchase-requests/${pr.id}`}
                className="group flex items-start justify-between gap-3 rounded-lg border border-navy-100 p-3 transition-colors hover:border-primary-200 hover:bg-navy-50/40"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-primary-700">{pr.reference_number}</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-navy-900">{pr.description}</p>
                  <p className="mt-0.5 text-[11px] text-navy-400">
                    {pr.requester_name} · {formatDate(pr.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={pr.status} />
                  <ArrowUpRight className="h-3.5 w-3.5 text-navy-300 transition-colors group-hover:text-primary-600" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
