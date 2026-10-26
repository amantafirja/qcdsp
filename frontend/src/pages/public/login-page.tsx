import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import { useLogin } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BrandMark } from '@/components/shared/brand-mark'

const schema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi').min(8, 'Password minimal 8 karakter'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  useDocumentTitle('Admin Login')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isAuthenticated } = useAuth()
  const loginMutation = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const redirectTo = searchParams.get('redirect') || '/admin'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, navigate, redirectTo])

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const result = await loginMutation.mutateAsync(values)
      login(result)
      toast.success(`Selamat datang, ${result.admin.name}`)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login gagal'
      setServerError(message)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-navy-900 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute -right-20 top-1/4 h-80 w-80 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative p-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-navy-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke portal
          </Link>
        </div>

        <div className="relative px-10 pb-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-6 max-w-md text-3xl font-bold leading-tight text-white">
            Admin Panel QC Digital Service Portal
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-200">
            Kelola dokumen Knowledge Center, kategori, dan seluruh Purchase Request laboratorium dari satu
            dashboard terintegrasi.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Dashboard statistik dan chart Purchase Request',
              'CRUD dokumen PDF dan artikel rich text',
              'Manajemen status dan catatan internal PR',
              'Export data Purchase Request ke Excel',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-navy-200">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                    <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative border-t border-white/10 px-10 py-5">
          <p className="text-xs text-navy-400">Internal use only · Laboratorium Quality Control</p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center bg-background px-5 py-10 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark />
          </div>

          <div className="mt-8 lg:mt-0">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">Masuk ke Admin Panel</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Gunakan kredensial admin yang telah diberikan oleh tim IT.
            </p>
          </div>

          {serverError && (
            <Alert variant="destructive" className="mt-5">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="Masukkan username"
                  className="pl-9"
                  aria-invalid={Boolean(errors.username)}
                  {...register('username')}
                />
              </div>
              {errors.username && <p className="field-error">{errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  className="pl-9 pr-10"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-navy-400 hover:bg-navy-100 hover:text-navy-700"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loginMutation.isPending}>
              {loginMutation.isPending ? 'Memverifikasi...' : 'Masuk'}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs">
            <Link to="/" className="inline-flex items-center gap-1 text-navy-500 hover:text-primary-700">
              <ArrowLeft className="h-3.5 w-3.5" />
              Portal publik
            </Link>
            <Link to="/tracking" className="text-navy-500 hover:text-primary-700">
              Tracking PR
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
