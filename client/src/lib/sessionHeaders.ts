let _location: string | undefined;
let _region: string | undefined;
let _locale: string | undefined;
let _userId: string | undefined;
let _authToken: string | undefined;

export function setSessionHeaders(location?: string, region?: string, locale?: string, userId?: string) {
  _location = location;
  _region = region;
  _locale = locale;
  _userId = userId;
}

export function setAuthToken(token: string | undefined) {
  _authToken = token;
}

export function getSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_location) headers["X-Session-Location"] = _location;
  if (_region) headers["X-Session-Region"] = _region;
  if (_locale) headers["X-Session-Locale"] = _locale;
  if (_userId) headers["X-User-Id"] = _userId;
  if (_authToken) headers["Authorization"] = `Token ${_authToken}`;
  return headers;
}
