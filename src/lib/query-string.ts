/** Builds a "?k=v&..." string, dropping undefined/empty params; "" if none remain. */
export function buildQueryString(
  params: Record<string, string | undefined>
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}
