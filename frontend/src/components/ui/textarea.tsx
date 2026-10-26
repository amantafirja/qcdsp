import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[92px] w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-navy-900 shadow-sm transition-colors',
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
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
