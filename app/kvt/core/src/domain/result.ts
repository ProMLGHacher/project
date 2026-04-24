export type Result<T, E = Error> = Ok<T> | Err<E>

export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type PromiseResult<T, E = Error> = Promise<Result<T, E>>

export function ok(): Ok<void>
export function ok<T>(value: T): Ok<T>
export function ok<T>(value?: T): Ok<T> | Ok<void> {
  if (arguments.length === 0) {
    return { ok: true, value: undefined }
  } else {
    return { ok: true, value: value as T }
  }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}
