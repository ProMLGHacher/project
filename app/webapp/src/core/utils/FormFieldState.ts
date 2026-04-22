export type FormFieldState<T> = {
  readonly value: T
  readonly error: string | null
}

export type FormFieldStateWithShowError<T> = {
  readonly value: T
  readonly error: string | null
  readonly showError: boolean
}
