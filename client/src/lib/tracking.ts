/**
 * Centralized tracking module for analytics and conversion events.
 * Abstracts GTM/dataLayer and provides type-safe event tracking.
 */

// Pre-defined conversion event names - keep in sync with marketing-content/component-registry/_common/schema.ts
export const CONVERSION_NAMES = [
  "student_application",
  "request_more_info",
  "financing_guide_download",
  "partner_application",
  "job_application",
  "newsletter_signup",
  "contact_us",
  "outcomes_report",
] as const;

export type ConversionName = typeof CONVERSION_NAMES[number];

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

// Visitor context for session-level data
export interface VisitorContext {
  visitor_id?: string;
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

// Extend Window to include dataLayer
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
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
 * Validate that an event name is allowed
 */
export function isValidConversionName(name: string): name is ConversionName {
  return CONVERSION_NAMES.includes(name as ConversionName);
}

export function isValidEventName(name: string): name is EventName {
  return CONVERSION_NAMES.includes(name as ConversionName) || 
         TRACKING_EVENTS.includes(name as TrackingEventName);
}

/**
 * Track a conversion event (form submissions, signups, etc.)
 * These events are validated against the pre-defined list.
 */
export function trackConversion(
  eventName: ConversionName,
  payload: ConversionPayload = {}
): void {
  if (!isValidConversionName(eventName)) {
    console.error(`[Tracking] Invalid conversion name: ${eventName}`);
    console.error(`[Tracking] Valid names: ${CONVERSION_NAMES.join(", ")}`);
    return;
  }

  pushToDataLayer({
    event: eventName,
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
  if (!isValidEventName(eventName)) {
    console.warn(`[Tracking] Unknown event name: ${eventName}`);
  }

  pushToDataLayer({
    event: eventName,
    ...payload,
  });

  console.log(`[Tracking] Event: ${eventName}`, payload);
}

/**
 * Set visitor context data in dataLayer (called once after session bootstrap)
 */
export function setVisitorContext(context: VisitorContext): void {
  pushToDataLayer({
    visitor_id: context.visitor_id,
    visitor_location_city: context.location_city,
    visitor_location_country: context.location_country,
    visitor_location_slug: context.location_slug,
    visitor_language: context.language,
    visitor_latitude: context.latitude,
    visitor_longitude: context.longitude,
    ...context.utm,
  });

  console.log("[Tracking] Visitor context set:", context);
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
