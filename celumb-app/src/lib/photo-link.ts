export type PhotoLinkParse =
  | { ok: true; url: string | null }
  | { ok: false };

/**
 * Empty clears the slot. A link without a scheme is saved as https.
 * Only http and https are stored. Returns ok:false when the text is not a URL.
 */
export function parsePhotoLink(value: unknown): PhotoLinkParse {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, url: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
  if (url.username || url.password) return { ok: false };
  if (!url.hostname || !url.hostname.includes(".")) return { ok: false };
  return { ok: true, url: url.toString() };
}
