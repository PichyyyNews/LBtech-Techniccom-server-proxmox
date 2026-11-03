import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
        {
          'border-transparent bg-slate-900 text-white': variant === 'default',
          'border-transparent bg-slate-100 text-slate-800': variant === 'secondary',
          'border-transparent bg-red-100 text-red-700': variant === 'destructive',
          'border-transparent bg-emerald-100 text-emerald-800': variant === 'success',
          'border-slate-200 text-slate-700 bg-white shadow-2xs': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="none"
      className={cn(
        'shrink-0 bg-slate-200',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  )
}

export { Badge, Separator }
