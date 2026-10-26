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
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Layers,
  PackageCheck,
  Send,
  Truck,
  XCircle,
  Loader2,
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
      label: 'Total PR Masuk',
      value:
        (stats?.total_submitted ?? 0) +
        (stats?.total_review ?? 0) +
        (stats?.total_approved ?? 0) +
        (stats?.total_rejected ?? 0) +
        (stats?.total_ordered ?? 0) +
        (stats?.total_received ?? 0) +
        (stats?.total_closed ?? 0),
      icon: ClipboardList,
      tone: 'bg-emerald-50 text-emerald-700',
      hint: 'Semua status pengajuan',
    },
  ]

  const prStatusCards = [
    { label: 'Submitted', value: stats?.total_submitted ?? 0, icon: Send, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Review', value: stats?.total_review ?? 0, icon: Loader2, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Approved', value: stats?.total_approved ?? 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rejected', value: stats?.total_rejected ?? 0, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Ordered', value: stats?.total_ordered ?? 0, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Received', value: stats?.total_received ?? 0, icon: PackageCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Closed', value: stats?.total_closed ?? 0, icon: ClipboardList, color: 'text-navy-600', bg: 'bg-navy-50' },
  ]

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-navy-400">{card.label}</p>
                {isLoading ? (
                  <div className="skeleton mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-2xl font-bold tabular-nums text-navy-900">
                    {formatNumber(card.value)}
                  </p>
                )}
              </div>
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', card.tone)}>
                <card.icon className="h-[18px] w-[18px]" />
              </span>
            </div>
            <p className="mt-2 text-[11px] text-navy-400">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {prStatusCards.map((card) => (
          <Link
            key={card.label}
            to={`/admin/purchase-requests?status=${card.label}`}
            className="group flex items-center gap-2.5 rounded-lg border border-border bg-white p-3 transition-all hover:border-primary-200 hover:shadow-card"
          >
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', card.bg, card.color)}>
              <card.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-navy-400">{card.label}</p>
              {isLoading ? (
                <div className="skeleton mt-1 h-5 w-8" />
              ) : (
                <p className="text-lg font-bold leading-tight tabular-nums text-navy-900">
                  {formatNumber(card.value)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Purchase Request per Bulan</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">12 bulan terakhir</p>
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
          <h3 className="text-sm font-semibold text-navy-900">Distribusi Status</h3>
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
          <h3 className="text-sm font-semibold text-navy-900">Distribusi Jenis Pemesanan</h3>
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
              <h3 className="text-sm font-semibold text-navy-900">Purchase Request Terbaru</h3>
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
