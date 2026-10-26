import * as React from 'react'
import { cn } from '@/lib/utils'

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' | 'warning' | 'success' | 'info' }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-current [&>svg~*]:pl-7',
      variant === 'default' && 'border-border bg-white text-navy-800',
      variant === 'destructive' && 'border-rose-200 bg-rose-50 text-rose-800 [&>svg]:text-rose-600',
      variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800 [&>svg]:text-amber-600',
      variant === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600',
      variant === 'info' && 'border-sky-200 bg-sky-50 text-sky-800 [&>svg]:text-sky-600',
      className,
    )}
    {...props}
  />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />
  ),
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)} {...props} />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
