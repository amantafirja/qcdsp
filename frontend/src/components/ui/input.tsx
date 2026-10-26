import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-navy-900 shadow-sm transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-navy-700',
        'placeholder:text-navy-400',
        'focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20',
        'disabled:cursor-not-allowed disabled:bg-navy-50 disabled:opacity-70',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
