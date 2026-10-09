export function isSQLiteBusyError(error: unknown): boolean {
  const message = collectErrorDetails(error, new Set());
  return /SQLITE_BUSY|database is locked|error code\s*5\b|(?:^|\W)code\s*[:=]\s*5\b/i.test(message);
}

function collectErrorDetails(value: unknown, seen: Set<object>): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';
  seen.add(value);

  const details = value as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    cause?: unknown;
    nativeError?: unknown;
  };

  const code = details.code === undefined ? '' : `code=${collectErrorDetails(details.code, seen)}`;
  return [
    collectErrorDetails(details.name, seen),
    collectErrorDetails(details.message, seen),
    code,
    collectErrorDetails(details.cause, seen),
    collectErrorDetails(details.nativeError, seen),
  ].join(' ');
}
