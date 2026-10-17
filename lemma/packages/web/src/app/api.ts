import type { ApiError } from '@lemma/core';

/** A failed API call, with the server's machine-readable code. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

type Listener = () => void;
const unauthenticatedListeners = new Set<Listener>();

/** Called when any request comes back 401, so the app can show the sign-in screen. */
export function onUnauthenticated(listener: Listener): () => void {
  unauthenticatedListeners.add(listener);
  return () => unauthenticatedListeners.delete(listener);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, 'offline', 'the server could not be reached');
  }
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    for (const listener of unauthenticatedListeners) listener();
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text === '' ? null : JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = (data ?? {}) as Partial<ApiError>;
    throw new ApiFailure(
      response.status,
      error.error ?? 'error',
      error.message ?? `request failed (${response.status})`,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown = {}): Promise<T> => request<T>('PUT', path, body),
  delete: <T>(path: string): Promise<T> => request<T>('DELETE', path),
};
