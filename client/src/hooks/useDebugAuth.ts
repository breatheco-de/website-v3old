import { useState, useEffect, useCallback, createContext, useContext, createElement, type ReactNode } from "react";
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

export function isDebugModeActive(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  
  if (debugParam === "false") {
    return false;
  }
  
  const isDev = import.meta.env.DEV;
  
  if (isDev) {
    return true;
  }
  
  const storedDebugMode = sessionStorage.getItem(DEBUG_MODE_KEY);
  if (storedDebugMode === "true") {
    return true;
  }
  
  if (debugParam === "true") {
    sessionStorage.setItem(DEBUG_MODE_KEY, "true");
    const url = new URL(window.location.href);
    url.searchParams.delete("debug");
    window.history.replaceState({}, "", url.toString());
    return true;
  }
  
  return false;
}

export function getDebugToken(): string | null {
  const cachedToken = localStorage.getItem(DEBUG_TOKEN_KEY);
  const cachedExpiry = localStorage.getItem(DEBUG_SESSION_EXPIRY_KEY);
  
  if (cachedToken && cachedExpiry) {
    const expiryTime = parseInt(cachedExpiry, 10);
    if (Date.now() < expiryTime) {
      return cachedToken;
    }
  }
  
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
  }
  return DEFAULT_CAPABILITIES;
}

export function getDebugUserName(): string {
  return localStorage.getItem(DEBUG_USERNAME_KEY) || "";
}

export async function resolveAuthorName(): Promise<string> {
  const cached = localStorage.getItem(DEBUG_USERNAME_KEY);
  if (cached) return cached;

  const token = getDebugToken();
  if (!token) return "Unknown";

  try {
    const response = await fetch("/api/debug/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (data.valid && data.userName) {
      localStorage.setItem(DEBUG_USERNAME_KEY, data.userName);
      return data.userName;
    }
  } catch {
  }
  return "Unknown";
}

interface DebugAuthValue {
  isValidated: boolean | null;
  hasToken: boolean;
  isLoading: boolean;
  isDevelopment: boolean;
  isDebugMode: boolean;
  capabilities: Capabilities;
  hasCapability: (capability: keyof Capabilities) => boolean;
  canEdit: boolean;
  retryValidation: () => Promise<void>;
  validateManualToken: (manualToken: string) => Promise<void>;
  clearToken: () => void;
  checkSession: () => Promise<{ valid: boolean; expired?: boolean; networkError?: boolean }>;
}

const DebugAuthContext = createContext<DebugAuthValue | null>(null);

export function DebugAuthProvider({ children }: { children: ReactNode }) {
  const [isValidated, setIsValidated] = useState<boolean | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<Capabilities>(DEFAULT_CAPABILITIES);
  
  const isDevelopment = import.meta.env.DEV;
  const isDebugMode = isDebugModeActive();

  const validateToken = useCallback(async (skipCache = false) => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    
    const forceValidate = !!urlToken || skipCache;
    
    let revalidateWithCachedToken = false;

    if (!forceValidate) {
      const cachedValidation = localStorage.getItem(DEBUG_SESSION_KEY);
      const cachedExpiry = localStorage.getItem(DEBUG_SESSION_EXPIRY_KEY);
      const cachedToken = localStorage.getItem(DEBUG_TOKEN_KEY);
      const cachedCaps = localStorage.getItem(DEBUG_CAPABILITIES_KEY);
      const cachedUsername = localStorage.getItem(DEBUG_USERNAME_KEY);
      
      if (cachedValidation === "true" && cachedExpiry && cachedToken) {
        const expiryTime = parseInt(cachedExpiry, 10);
        if (Date.now() < expiryTime) {
          if (cachedUsername) {
            setHasToken(true);
            setIsValidated(true);
            if (cachedCaps) {
              try {
                setCapabilities(JSON.parse(cachedCaps));
              } catch {
              }
            }
            setIsLoading(false);
            return;
          }
          revalidateWithCachedToken = true;
        }
      }
    } else {
      localStorage.removeItem(DEBUG_SESSION_KEY);
      localStorage.removeItem(DEBUG_SESSION_EXPIRY_KEY);
      localStorage.removeItem(DEBUG_TOKEN_KEY);
      localStorage.removeItem(DEBUG_CAPABILITIES_KEY);
    }

    const envToken = import.meta.env.VITE_BREATHECODE_TOKEN;
    
    const token = urlToken || envToken || (revalidateWithCachedToken ? localStorage.getItem(DEBUG_TOKEN_KEY) : null);

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
      
      if (urlToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }

      if (data.valid) {
        localStorage.setItem(DEBUG_SESSION_KEY, "true");
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

  const retryValidation = useCallback(() => {
    return validateToken(true);
  }, [validateToken]);

  const validateManualToken = useCallback(async (manualToken: string) => {
    if (!manualToken.trim()) return;
    
    setHasToken(true);
    setIsLoading(true);
    
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
        if (data.expiresAt) {
          const expiryTime = new Date(data.expiresAt).getTime();
          localStorage.setItem(DEBUG_SESSION_EXPIRY_KEY, String(expiryTime));
        }
        return { valid: true };
      } else if (data.networkError) {
        console.warn("Network error checking session:", data.error);
        return { valid: false, networkError: true };
      } else {
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
      console.error("Session check error:", error);
      return { valid: false, networkError: true };
    }
  }, []);

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

  const hasCapability = useCallback((capability: keyof Capabilities): boolean => {
    return capabilities[capability] === true;
  }, [capabilities]);

  const canEdit = capabilities.content_edit_text || 
                  capabilities.content_edit_structure || 
                  capabilities.content_edit_media;

  const value: DebugAuthValue = {
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
    checkSession,
  };

  return createElement(DebugAuthContext.Provider, { value }, children);
}

export function useDebugAuth(): DebugAuthValue {
  const context = useContext(DebugAuthContext);
  if (!context) {
    throw new Error("useDebugAuth must be used within a DebugAuthProvider");
  }
  return context;
}
