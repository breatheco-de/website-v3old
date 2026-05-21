# GTM & Analytics Setup

This document describes how to configure Google Tag Manager (GTM) and GA4 to work with the tracking layer in this project.

## Overview

The site uses a client-side `dataLayer` (via GTM) to send tracking events and user context to GA4. The tracking module lives at `client/src/lib/tracking.ts`.

## Data Layer Variables

Configure the following Data Layer Variables (DLVs) in GTM:

| GTM Variable Name   | Data Layer Key              | Description                          |
|---------------------|-----------------------------|--------------------------------------|
| DLV - user_id       | `user_id`                   | Stable user identity (UUID)          |
| DLV - utm_source    | `utm_source`                | UTM source parameter                 |
| DLV - utm_medium    | `utm_medium`                | UTM medium parameter                 |
| DLV - utm_campaign  | `utm_campaign`              | UTM campaign parameter               |
| DLV - utm_content   | `utm_content`               | UTM content parameter                |
| DLV - utm_term      | `utm_term`                  | UTM term parameter                   |

### user_id

The `user_id` is a stable UUID that persists across sessions via the `4g_user_id` cookie (180-day expiry). It is pushed to the dataLayer on every page load via `setVisitorContext()` in `SessionContext.tsx`.

In GTM, create a Data Layer Variable named `DLV - user_id` that reads from `user_id`.

In GA4, you can pass this as the `user_id` field in your GA4 configuration tag to enable cross-device and cross-session user identification.

## Conversion Events

The following conversion events are tracked and should be configured as GA4 conversion events in GTM:

| Event Name                 | Trigger                                      |
|----------------------------|----------------------------------------------|
| `student_application`      | Student applies to a program                 |
| `request_more_info`        | User submits a "more info" form              |
| `financing_guide_download` | User downloads the financing guide           |
| `partner_application`      | Partner submits an application               |
| `job_application`          | User applies for a job                       |
| `newsletter_signup`        | User signs up for the newsletter             |
| `contact_us`               | User submits a contact form                  |
| `outcomes_report`          | User downloads the outcomes report           |

All conversion events include `user_id` in the dataLayer push.

## General Tracking Events

| Event Name            | Description                        |
|-----------------------|------------------------------------|
| `page_view`           | Fired on each page navigation      |
| `experiment_exposure` | A/B test variant assignment        |
| `cta_click`           | User clicks a call-to-action       |
| `video_play`          | User plays a video                 |
| `scroll_depth`        | User scrolls to a depth threshold  |

## Cookie Reference

| Cookie Name      | Description                                   | Max Age  |
|------------------|-----------------------------------------------|----------|
| `4g_user_id`     | Stable user identity (client-readable UUID)   | 180 days |
| `4g_versioning`  | A/B test variant assignments (HttpOnly)       | 30 days  |

> **Note:** The legacy cookie name `4g_visitor_id` is still read as a fallback for backward compatibility, but all new sessions write to `4g_user_id`.

## HTTP Headers

The frontend sends the following session headers with every API request:

| Header              | Value                        |
|---------------------|------------------------------|
| `X-User-Id`         | The user's stable UUID       |
| `X-Session-Location`| Location campus slug         |
| `X-Session-Region`  | Geographic region            |
| `X-Session-Locale`  | Active locale (`en` or `es`) |
