/**
 * Centralized tracking module for analytics and conversion events.
 * Abstracts GTM/dataLayer and provides type-safe event tracking.
 */

import { getUserIdFromCookie } from "./sessionBootstrap";
import { useQuery } from "@tanstack/react-query";

export type ConversionName = string;

// General tracking events (non-conversion)
export const TRACKING_EVENTS = [
  "page_view",
  "experiment_exposure",
  "cta_click",
  "video_play",
  "scroll_depth",
] as const;

export type TrackingEventName = typeof TRACKING_EVENTS[number];

// All valid event names
export type EventName = ConversionName | TrackingEventName;

// Payload types for different events
export interface ConversionPayload {
  email_hash?: string;
  formentry_id?: string | number;
  attribution_id?: string;
  referral_key?: string;
  program?: string;
  location?: string;
  [key: string]: string | number | undefined;
}

export interface TrackingPayload {
  [key: string]: string | number | boolean | undefined | object;
}

// User context for session-level data
export interface VisitorContext {
  user_id?: string;
  location_city?: string;
  location_country?: string;
  location_slug?: string;
  language?: string;
  latitude?: number;
  longitude?: number;
  utm?: {
    utm_campaign?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_content?: string;
    utm_term?: string;
    gclid?: string;
    referral_code?: string;
  };
}

export interface ConversionEventEntry {
  name: string;
  description?: string;
}

export interface TrackingSettingsResponse {
  conversion_events: ConversionEventEntry[];
}

// Extend Window to include dataLayer
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/**
 * React hook that returns the list of configured conversion event names from the API.
 */
export function useConversionNames(): { names: string[]; isLoading: boolean } {
  const { data, isLoading } = useQuery<TrackingSettingsResponse>({
    queryKey: ["/api/settings/tracking"],
  });

  return {
    names: data?.conversion_events.map((e) => e.name) ?? [],
    isLoading,
  };
}

/**
 * Fetch conversion event names from the API (async, one-shot).
 */
export async function fetchConversionNames(): Promise<string[]> {
  try {
    const res = await fetch("/api/settings/tracking");
    if (!res.ok) return [];
    const data: TrackingSettingsResponse = await res.json();
    return data.conversion_events.map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Hash an email address for privacy (SHA-256 truncated)
 * Used to track conversions without exposing PII
 */
export async function hashEmail(email: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    // Fallback: simple hash for SSR or unsupported browsers
    return btoa(email.toLowerCase().trim()).substring(0, 16);
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex.substring(0, 16);
}

/**
 * Push data to GTM dataLayer
 */
function pushToDataLayer(data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  
  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  
  window.dataLayer.push(data);
  
  console.log("[Tracking] dataLayer.push:", data);
}

/**
 * Validate that a conversion event name is in the provided list.
 * When no list is provided the check is skipped (permissive).
 */
export function isValidConversionName(name: string, conversionNames?: string[]): boolean {
  if (!conversionNames) return true;
  return conversionNames.includes(name);
}

export function isValidEventName(name: string): boolean {
  return TRACKING_EVENTS.includes(name as TrackingEventName);
}

/**
 * Track a conversion event (form submissions, signups, etc.)
 */
export function trackConversion(
  eventName: ConversionName,
  payload: ConversionPayload = {}
): void {
  pushToDataLayer({
    event: eventName,
    user_id: getUserIdFromCookie() ?? undefined,
    ...payload,
  });

  console.log(`[Tracking] Conversion: ${eventName}`, payload);
}

/**
 * Track a general event (page views, clicks, etc.)
 */
export function track(
  eventName: EventName,
  payload: TrackingPayload = {}
): void {
  pushToDataLayer({
    event: eventName,
    user_id: getUserIdFromCookie() ?? undefined,
    ...payload,
  });

  console.log(`[Tracking] Event: ${eventName}`, payload);
}

/**
 * Set user context data in dataLayer (called once after session bootstrap)
 */
export function setVisitorContext(context: VisitorContext): void {
  pushToDataLayer({
    user_id: context.user_id,
    visitor_location_city: context.location_city,
    visitor_location_country: context.location_country,
    visitor_location_slug: context.location_slug,
    visitor_language: context.language,
    visitor_latitude: context.latitude,
    visitor_longitude: context.longitude,
    ...context.utm,
  });

  console.log("[Tracking] User context set:", context);
}

/**
 * Helper to track form submission
 */
export async function trackFormSubmission(
  conversionName: ConversionName,
  formData: {
    email?: string;
    program?: string;
    location?: string;
    formentry_id?: string | number;
    attribution_id?: string;
    referral_key?: string;
  }
): Promise<void> {
  const payload: ConversionPayload = {
    program: formData.program,
    location: formData.location,
    formentry_id: formData.formentry_id,
    attribution_id: formData.attribution_id,
    referral_key: formData.referral_key,
  };

  // Hash email for privacy
  if (formData.email) {
    payload.email_hash = await hashEmail(formData.email);
  }

  trackConversion(conversionName, payload);
}
