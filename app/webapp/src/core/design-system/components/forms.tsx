import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { cn } from '../utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'min-h-11 w-full rounded-2xl border border-input/90 bg-surface-overlay px-4 text-sm text-foreground shadow-sm backdrop-blur-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export function InputGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-stretch gap-2', className)} {...props} />
}

export interface InputOtpProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'maxLength'> {
  length?: number
}

export const InputOTP = forwardRef<HTMLInputElement, InputOtpProps>(
  ({ className, length = 6, inputMode = 'numeric', ...props }, ref) => (
    <Input
      ref={ref}
      inputMode={inputMode}
      maxLength={length}
      className={cn('max-w-56 text-center tracking-widest', className)}
      {...props}
    />
  )
)
InputOTP.displayName = 'InputOTP'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-24 w-full resize-y rounded-2xl border border-input/90 bg-surface-overlay p-4 text-sm text-foreground shadow-sm backdrop-blur-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-semibold text-foreground', className)}
      {...props}
    />
  )
)
Label.displayName = 'Label'

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-2', className)} {...props} />
}

export function FieldHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-snug text-muted-foreground', className)} {...props} />
}

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input ref={ref} type="checkbox" className={cn('size-4 accent-primary', className)} {...props} />
))
Checkbox.displayName = 'Checkbox'

export function RadioGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="radiogroup" className={cn('grid gap-2', className)} {...props} />
}

export const Radio = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input ref={ref} type="radio" className={cn('size-4 accent-primary', className)} {...props} />
))
Radio.displayName = 'Radio'

export interface SwitchProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, disabled, onCheckedChange, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-7 w-12 rounded-full border border-border/70 p-0.5 shadow-inner transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        className={cn(
          'size-5 rounded-full bg-surface shadow-sm transition',
          checked && 'translate-x-5'
        )}
      />
    </button>
  )
)
Switch.displayName = 'Switch'

export const Slider = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input ref={ref} type="range" className={cn('w-full accent-primary', className)} {...props} />
))
Slider.displayName = 'Slider'

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'min-h-11 w-full rounded-2xl border border-input/90 bg-surface-overlay px-4 text-sm text-foreground shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  )
)
NativeSelect.displayName = 'NativeSelect'

export const Select = NativeSelect

export const Calendar = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <Input ref={ref} type="date" className={className} {...props} />
))
Calendar.displayName = 'Calendar'

export const DatePicker = Calendar
