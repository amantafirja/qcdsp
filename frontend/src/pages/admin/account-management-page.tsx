import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Edit, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAdminAccounts,
  useCreateAdminAccount,
  useDeleteAdminAccount,
  useUpdateAdminAccount,
} from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { EmptyState, ErrorState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ADMIN_ROLES, ROLE_META } from '@/lib/permissions'
import { formatDate, formatDateTime } from '@/lib/format'
import type { AdminRole, AdminUser } from '@/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(150, 'Maksimal 150 karakter'),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(80, 'Maksimal 80 karakter')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Hanya huruf, angka, titik, garis bawah, dan tanda hubung'),
  role: z.enum(['super_admin', 'admin', 'pr_viewer']),
  password: z.string().optional(),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function AccountManagementPage() {
  useDocumentTitle('Account Management')
  const { admin } = useAuth()
  const { data: accounts, isLoading, isError, refetch } = useAdminAccounts()
  const createMutation = useCreateAdminAccount()
  const updateMutation = useUpdateAdminAccount()
  const deleteMutation = useDeleteAdminAccount()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', username: '', role: 'admin', password: '', isActive: true },
  })

  const roleValue = watch('role')
  const isActiveValue = watch('isActive')

  const openCreate = () => {
    setEditing(null)
    reset({ name: '', username: '', role: 'admin', password: '', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (account: AdminUser) => {
    setEditing(account)
    reset({
      name: account.name,
      username: account.username,
      role: account.role,
      password: '',
      isActive: account.is_active,
    })
    setDialogOpen(true)
  }

  const onSubmit = async (values: FormValues) => {
    if (!editing && !values.password) {
      toast.error('Password wajib diisi untuk akun baru')
      return
    }
    if (values.password && values.password.length < 8) {
      toast.error('Password minimal 8 karakter')
      return
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          name: values.name,
          username: values.username,
          role: values.role,
          password: values.password || undefined,
          is_active: values.isActive,
        })
        toast.success('Akun berhasil diperbarui')
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          username: values.username,
          role: values.role,
          password: values.password,
          is_active: values.isActive,
        })
        toast.success('Akun berhasil dibuat')
      }
      setDialogOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan akun')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Akun berhasil dihapus')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus akun')
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-navy-900">Account Management</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola akun admin dan hak aksesnya. Hanya Super Admin yang dapat mengakses halaman ini.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tambah Akun
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ADMIN_ROLES.map((role) => (
          <div key={role} className="rounded-lg border border-navy-100 bg-white p-3">
            <Badge className={ROLE_META[role].badge}>{ROLE_META[role].label}</Badge>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ROLE_META[role].description}</p>
          </div>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        {isError ? (
          <div className="p-4">
            <ErrorState message="Gagal memuat daftar akun." onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : (accounts ?? []).length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Belum ada akun"
              description="Tambahkan akun admin pertama."
              icon={<Users className="h-6 w-6" />}
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Akun
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Nama & Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Login Terakhir</TableHead>
                <TableHead className="hidden md:table-cell">Dibuat</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts ?? []).map((account) => {
                const isSelf = account.id === admin?.id
                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy-900">
                            {account.name}
                            {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-primary-700">(Anda)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">@{account.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ROLE_META[account.role].badge}>{ROLE_META[account.role].label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? 'success' : 'secondary'}>
                        {account.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-navy-500 lg:table-cell">
                      {account.last_login_at ? formatDateTime(account.last_login_at) : 'Belum pernah'}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-navy-500 md:table-cell">
                      {formatDate(account.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(account)} aria-label="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(account)}
                          disabled={isSelf}
                          aria-label="Hapus"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:text-navy-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Akun' : 'Tambah Akun'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Perbarui profil, role, status, atau reset password akun.'
                : 'Buat akun admin baru beserta hak aksesnya.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Contoh: Rina Wulandari"
                maxLength={150}
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                placeholder="contoh: rina.wulandari"
                maxLength={80}
                autoComplete="off"
                aria-invalid={Boolean(errors.username)}
                {...register('username')}
              />
              {errors.username && <p className="field-error">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Role / Hak Akses</Label>
              <Select value={roleValue} onValueChange={(value) => setValue('role', value as AdminRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_META[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="field-hint">{ROLE_META[roleValue].description}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">
                {editing ? 'Password Baru (opsional)' : 'Password'}
                {!editing && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}
                {...register('password')}
              />
              <p className="field-hint">
                {editing ? 'Isi hanya jika ingin mengganti password akun ini.' : 'Minimal 8 karakter.'}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-navy-100 bg-navy-50/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-navy-800">Akun aktif</p>
                <p className="text-[11px] text-muted-foreground">Akun nonaktif tidak dapat login.</p>
              </div>
              <Switch
                checked={isActiveValue}
                onCheckedChange={(checked) => setValue('isActive', checked)}
                disabled={editing?.id === admin?.id}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Simpan Perubahan' : 'Simpan Akun'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <span className="font-semibold text-navy-800">{deleteTarget?.name}</span> (@
              {deleteTarget?.username}) akan dihapus permanen dan tidak dapat login lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}