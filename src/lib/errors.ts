type ErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  context?: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return null;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback;
  if (error instanceof Error) {
    const anyErr = error as any;
    const context = anyErr?.context as
      | {
          status?: unknown;
          body?: unknown;
        }
      | undefined;
    const status = context ? asString(context.status) : null;
    const bodyStr =
      context && context.body
        ? typeof context.body === 'string'
          ? context.body
          : (() => {
              try {
                return JSON.stringify(context.body);
              } catch {
                return null;
              }
            })()
        : null;

    const base = error.message || fallback;
    const extras = [status ? `Status: ${status}` : null, bodyStr ? `Body: ${bodyStr}` : null].filter(Boolean);
    return extras.length ? `${base} (${extras.join(' ')})` : base;
  }

  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const e = error as ErrorLike;
    const msg = asString(e.message);
    const code = asString(e.code);
    const details = asString(e.details);
    const hint = asString(e.hint);
    const context = e.context as
      | {
          status?: unknown;
          body?: unknown;
        }
      | undefined;

    const status = context ? asString(context.status) : null;
    const bodyStr = context
      ? typeof context.body === 'string'
        ? context.body
        : (() => {
            try {
              return context.body ? JSON.stringify(context.body) : null;
            } catch {
              return null;
            }
          })()
      : null;

    const parts = [
      code ? `[${code}]` : null,
      msg ?? null,
      details ? `Details: ${details}` : null,
      hint ? `Hint: ${hint}` : null,
      status ? `Status: ${status}` : null,
      bodyStr ? `Body: ${bodyStr}` : null,
    ].filter(Boolean);

    if (parts.length) return parts.join(' ');

    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

