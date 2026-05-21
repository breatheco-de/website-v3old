let _location: string | undefined;
let _region: string | undefined;
let _locale: string | undefined;
let _visitorId: string | undefined;

export function setSessionHeaders(location?: string, region?: string, locale?: string, visitorId?: string) {
  _location = location;
  _region = region;
  _locale = locale;
  _visitorId = visitorId;
}

export function getSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_location) headers["X-Session-Location"] = _location;
  if (_region) headers["X-Session-Region"] = _region;
  if (_locale) headers["X-Session-Locale"] = _locale;
  if (_visitorId) headers["X-Visitor-Id"] = _visitorId;
  return headers;
}
