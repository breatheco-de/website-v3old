import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { contentIndex } from "./content-index";

const viteLogger = createLogger();

const STATIC_ROUTES = new Set([
  "/", "/en", "/en/", "/es", "/es/",
  "/old-home", "/en/apply", "/es/aplica",
  "/terms-conditions", "/terminos-condiciones",
  "/privacy-policy", "/politica-privacidad",
  "/preview-frame",
]);

const STATIC_PREFIXES = ["/private/", "/api/"];

function isKnownRoute(url: string): boolean {
  const cleanUrl = url.split("?")[0].split("#")[0];
  if (STATIC_ROUTES.has(cleanUrl)) return true;
  for (const prefix of STATIC_PREFIXES) {
    if (cleanUrl.startsWith(prefix)) return true;
  }
  try {
    if (contentIndex.isKnownUrl(cleanUrl)) return true;
  } catch {}
  return false;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async