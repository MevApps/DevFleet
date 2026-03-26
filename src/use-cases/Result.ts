export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function failure<T = never>(error: string): Result<T> {
  return { ok: false, error }
}
