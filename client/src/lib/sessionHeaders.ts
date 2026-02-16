let _location: string | undefined;
let _region: string | undefined;
let _locale: string | undefined;

export function setSessionHeaders(location?: string, region?: string, locale?: string) {
  _location = location;
  _region = region;
  _locale = locale;
}

export function getSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_location) headers["X-Session-Location"] = _location;
  if (_region) headers["X-Session-Region"] = _region;
  if (_locale) headers["X-Session-Locale"] = _locale;
  return headers;
}
