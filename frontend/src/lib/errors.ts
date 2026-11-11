/** The API throws its JSON error envelope (not an Error), so normalise anything we catch into text. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    const issues = (error as { field_errors?: Array<{ issue?: string }> }).field_errors;
    const detail = issues?.[0]?.issue;
    return detail ? `${(error as { message: string }).message} ${detail}` : (error as { message: string }).message;
  }
  return fallback;
}
