import { useState, useEffect, useCallback } from "react";
import type { Capabilities } from "@shared/schema";

const DEBUG_SESSION_KEY = "debug_validated";
const DEBUG_SESSION_EXPIRY_KEY = "debug_validated_expiry";
const DEBUG_TOKEN_KEY = "debug_token";
const DEBUG_MODE_KEY = "debug_mode";
const DEBUG_CAPABILITIES_KEY = "debug_capabilities";
const DEBUG_USERNAME_KEY = "debug_username";

const DEFAULT_CAPABILITIES: Capabilities = {
  webmaster: false,
  content_read: false,
  content_edit_text: false,
  content_edit_structure: false,
  content_edit_media: false,
  content_publish: false,
};

// Check if debug mode is active
// In development: always true
// In production: requires ?debug=true in URL (persisted in sessionStorage)
export function isDebugModeActive(): boolean {
  // Check URL for ?debug=false first - explicit override to disable
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  
  if (debugParam === "false") {
    return false;
  }
  
  const isDev = import.meta.env.DEV;
  
  // Always active in development (unless explicitly disabled above)
  if (isDev) {
    return true;
  }
  
  // Check sessionStorage first (persists across navigation)
  const storedDebugMode = sessionStorage.getItem(DEBUG_MODE_KEY);
  if (storedDebugMode === "true") {
    return true;
  }
  
  if (debugParam === "true") {
    // Store in sessionStorage and clean up URL
    sessionStorage.setItem(DEBUG_MODE_KEY, "true");
    const url = new URL(window.location.href);
    url.searchParams.delete("debug");
    window.history.replaceState({}, "", url.toString());
    return true;
  }
  
  return false;
}

export function getDebugToken(): string | null {
  // Check localStorage for cached token (persists across tabs)
  const cachedToken = localStorage.getItem(DEBUG_TOKEN_KEY);
  const cachedExpiry = localStorage.getItem(DEBUG_SESSION_EXPIRY_KEY);
  
  if (cachedToken && cachedExpiry) {
    const expiryTime = parseInt(cachedExpiry, 10);
    if (Date.now() < expiryTime) {
      return cachedToken;
    }
  }
  
  // Fall back to URL or env variable
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get("token");
  const envToken = import.meta.env.VITE_BREATHECODE_TOKEN;
  
  return urlToken || envToken || null;
}

export function getCachedCapabilities(): Capabilities {
  try {
    const cached = localStorage.getItem(DEBUG_CAPABILITIES_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_CAPABILITIES;
}

export function getDebugUserName(): string {
  return localStorage.getItem(DEBUG_USERNAME_KEY) || "";
}

export function useDebugAuth() {
  const [isValidated, setIsValidated] = useState<boolean | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<Capabilities>(DEFAULT_CAPABILITIES);
  
  const isDevelopment = import.meta.env.DEV;
  const isDebugMode = isDebugModeActive();

  const validateToken = useCallback(async (skipCache = false) => {
    // Check if a token was provided via URL querystring
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    
    // URL token always takes priority and bypasses cache (acts like manual validate)
    const forceValidate = !!urlToken || skipCache;
    
    // Check if we have a valid cached session (unless forced)
    if (!forceValidate) {
      const cachedValidation = localStorage.getItem(DEBUG_SESSION_KEY);
      const cachedExpiry = localStorage.getItem(DEBUG_SESSION_EXPIRY_KEY);
      const cachedToken = localStorage.getItem(DEBUG_TOKEN_KEY);
      const cachedCaps = localStorage.getItem(DEBUG_CAPABILITIES_KEY);
      const cachedUsername = localStorage.getItem(DEBUG_USERNAME_KEY);
      
      if (cachedValidation === "true" && cachedExpiry && cachedToken && cachedUsername) {
        const expiryTime = parseInt(cachedExpiry, 10);
        if (Date.now() < expiryTime) {
          setHasToken(true);
          setIsValidated(true);
          if (cachedCaps) {
            try {
              setCapabilities(JSON.parse(cachedCaps));
            } catch {
              // Ignore
            }
          }
          setIsLoading(false);
          return;
        }
      }
    } else {
      // Clear cache when forced
      localStorage.removeItem(DEBUG_SESSION_KEY);
      localStorage.removeItem(DEBUG_SESSION_EXPIRY_KEY);
      localStorage.removeItem(DEBUG_TOKEN_KEY);
      localStorage.removeItem(DEBUG_CAPABILITIES_KEY);
    }

    // Get token from URL querystring or env variable
    const envToken = import.meta.env.VITE_BREATHECODE_TOKEN;
    
    const token = urlToken || envToken || localStorage.getItem(DEBUG_TOKEN_KEY);

    if (!token) {
      setHasToken(false);
      setIsValidated(false);
      setCapabilities(DEFAULT_CAPABILITIES);
      setIsLoading(false);
      return;
    }

    setHasToken(true);
    setIsLoading(true);

    try {
      const response = await fetch("/api/debug/validate-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      
      // Clean up URL after fetch completes (not before) so other hook instances can read the token
      if (urlToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }

      if (data.valid) {
        // Cache the validation result, token, capabilities, and userName with real expiry from Breathecode
        localStorage.setItem(DEBUG_SESSION_KEY, "true");
        // Use real expiry from Breathecode API, or fallback to 24 hours if not provided
        const expiryTime = data.expiresAt 
          ? new Date(data.expiresAt).getTime() 
          : Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem(DEBUG_SESSION_EXPIRY_KEY, String(expiryTime));
        localStorage.setItem(DEBUG_TOKEN_KEY, token);
        if (data.capabilities) {
          localStorage.setItem(DEBUG_CAPABILITIES_KEY, JSON.stringify(data.capabilities));
          setCapabilities(data.capabilities);
        }
        if (data.userName) {
          localStorage.setItem(DEBUG_USERNAME_KEY, data.userName);
        }
        setIsValidated(true);
      } else {
        localStorage.removeItem(DEBUG_SESSION_KEY);
        localStorage.removeItem(DEBUG_SESSION_EXPIRY_KEY);
        localStorage.removeItem(DEBUG_TOKEN_KEY);
        localStorage.removeItem(DEBUG_CAPABILITIES_KEY);
        localStorage.removeItem(DEBUG_USERNAME_KEY);
        setCapabilities(data.capabilities || DEFAULT_CAPABILITIES);
        setIsValidated(false);
      }
    } catch (error) {
      console.error("Debug auth validation error:", error);
      setIsValidated(false);
      setCapabilities(DEFAULT_CAPABILITIES);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    validateToken(false);
  }, [validateToken]);

  // Retry validation (clears cache and re-validates)
  const retryValidation = useCallback(() => {
    return validateToken(true);
  }, [validateToken]);

  // Validate a manually entered token
  const validateManualToken = useCallback(async (manualToken: string) => {
    if (!manualToken.trim()) return;
    
    setHasToken(true);
    setIsLoading(true);
    
    // Clear any existing cache
    localStorage.removeItem(DEBUG_SESSION_KEY);
    localStorage.removeItem(DEBUG_SESSION_EXPIRY_KEY);
    localStorage.removeItem(DEBUG_TOKEN_KEY);
    localStorage.removeItem(DEBUG_CAPABILITIES_KEY);
    localStorage.removeItem(DEBUG_USERNAME_KEY);

    try {
      const response = await fetch("/api/debug/validate-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: manualToken }),
      });

      const data = await response.json();
      
      if (data.valid) {
        localStorage.setItem(DEBUG_SESSION_KEY, "true");
        // Use real expiry from Breathecode API, or fallback to 24 hours if not provided
        const expiryTime = data.expiresAt 
          ? new Date(data.expiresAt).getTime() 
          : Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem(DEBUG_SESSION_EXPIRY_KEY, String(expiryTime));
        localStorage.setItem(DEBUG_TOKEN_KEY, manualToken);
        if (data.capabilities) {
          localStorage.setItem(DEBUG_CAPABILITIES_KEY, JSON.stringify(data.capabilities));
          setCapabilities(data.capabilities);
        }
        if (data.userName) {
          localStorage.setItem(DEBUG_USERNAME_KEY, data.userName);
        }
        setIsValidated(true);
      } else {
        setCapabilities(data.capabilities || DEFAULT_CAPABILITIES);
        setIsValidated(false);
      }
    } catch (error) {
      console.error("Debug auth validation error:", error);
      setIsValidated(false);
      setCapabilities(DEFAULT_CAPABILITIES);
    }

    setIsLoading(false);
  }, []);

  // Check session validity without clearing cache - useful for refresh button
  const checkSession = useCallback(async (): Promise<{ valid: boolean; expired?: boolean; networkError?: boolean }> => {
    const cachedToken = localStorage.getItem(DEBUG_TOKEN_KEY);
    
    if (!cachedToken) {
      return { valid: false };
    }

    try {
      const response = await fetch("/api/debug/check-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: cachedToken }),
      });

      const data = await response.json();
      
      if (data.valid) {
        // Update expiry time if provided
        if (data.expiresAt) {
          const expiryTime = new Date(data.expiresAt).getTime();
          localStorage.setItem(DEBUG_SESSION_EXPIRY_KEY, String(expiryTime));
        }
        return { valid: true };
      } else if (data.networkError) {
        // Network error - don't clear cache, just report error
        console.warn("Network error checking session:", data.error);
        return { valid: false, networkError: true };
      } else {
        // Token is actually invalid or expired - clear cache
        localStorage.removeItem(DEBUG_SESSION_KEY);
        localStorage.removeItem(DEBUG_SESSION_EXPIRY_KEY);
        localStorage.removeItem(DEBUG_TOKEN_KEY);
        localStorage.removeItem(DEBUG_CAPABILITIES_KEY);
        localStorage.removeItem(DEBUG_USERNAME_KEY);
        setHasToken(false);
        setIsValidated(false);
        setCapabilities(DEFAULT_CAPABILITIES);
        return { valid: false, expired: data.expired };
      }
    } catch (error) {
      // Client-side network error - don't clear cache
      console.error("Session check error:", error);
      return { valid: false, networkError: true };
    }
  }, []);

  // Clear token and reset to "no token" state
  const clearToken = useCallback(() => {
    localStorage.removeItem(DEBUG_SESSION_KEY);
    localStorage.removeItem(DEBUG_SESSION_EXPIRY_KEY);
    localStorage.removeItem(DEBUG_TOKEN_KEY);
    localStorage.removeItem(DEBUG_CAPABILITIES_KEY);
    localStorage.removeItem(DEBUG_USERNAME_KEY);
    setHasToken(false);
    setIsValidated(false);
    setCapabilities(DEFAULT_CAPABILITIES);
  }, []);

  // Check if user has a specific capability
  const hasCapability = useCallback((capability: keyof Capabilities): boolean => {
    return capabilities[capability] === true;
  }, [capabilities]);

  // Check if user can edit content (has any edit capability)
  const canEdit = capabilities.content_edit_text || 
                  capabilities.content_edit_structure || 
                  capabilities.content_edit_media;

  return { 
    isValidated, 
    hasToken, 
    isLoading, 
    isDevelopment, 
    isDebugMode, 
    capabilities,
    hasCapability,
    canEdit,
    retryValidation, 
    validateManualToken, 
    clearToken,
    checkSession
  };
}
