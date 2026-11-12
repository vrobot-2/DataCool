/**
 * Where "Customise your solution" sends people. The URL has not been provided yet:
 * set VITE_CTA_URL (e.g. in app2d/.env) or edit the fallback below.
 */
export const CTA_URL: string = (import.meta.env.VITE_CTA_URL as string | undefined) ?? '';

/** Build the link with the calculator state appended as query parameters. */
export function ctaHref(params: Record<string, string>): string {
  if (!CTA_URL) return '';
  const url = new URL(CTA_URL, window.location.href);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('utm_source', 'datacool-site');
  return url.toString();
}
