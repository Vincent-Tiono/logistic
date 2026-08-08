/** Filenames for CSV downloads here can contain non-ASCII (an em dash
 * between no_pk and mothervessel). Unlike PHP's header(), which writes
 * whatever raw bytes it's given, Fastify re-encodes header string values as
 * UTF-8 when writing the response, corrupting a literal non-ASCII character
 * in `filename=`. RFC 6266's `filename*` extension carries the real name as
 * percent-encoded (pure-ASCII) UTF-8 instead, with a sanitized ASCII
 * fallback in `filename=` for clients that don't support it. */
export function contentDispositionAttachment(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
