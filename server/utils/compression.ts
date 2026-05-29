/**
 * Unified HTTP compression middleware supporting Brotli (br) and gzip.
 *
 * Replaces the `compression` npm package (gzip-only) with a single middleware
 * that:
 *  - Prefers Brotli when the client advertises `Accept-Encoding: br`
 *  - Falls back to gzip when the client advertises `Accept-Encoding: gzip`
 *  - Skips already-encoded responses and binary content types
 *  - Uses Node's built-in `zlib` module — no native add-ons required
 *
 * Works correctly with both buffered (res.send) and streaming (res.write +
 * res.end) response paths because it intercepts at the write/end level.
 */
import zlib from "zlib";
import type { Request, Response, NextFunction } from "express";

const COMPRESSIBLE_RE = /text|javascript|json|xml|svg|x-font|woff/i;
const MIN_THRESHOLD = 1024;

function isCompressible(res: Response): boolean {
  if (res.getHeader("Content-Encoding")) return false;
  const ct = String(res.getHeader("Content-Type") || "");
  return COMPRESSIBLE_RE.test(ct);
}

function pickEncoding(acceptEncoding: string): "br" | "gzip" | null {
  const parts = acceptEncoding
    .split(",")
    .map((e) => e.trim().split(";")[0].trim().toLowerCase());
  if (parts.includes("br")) return "br";
  if (parts.includes("gzip")) return "gzip";
  return null;
}

export function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  const encoding = pickEncoding(acceptEncoding);

  if (!encoding) return next();

  const originalWrite = res.write.bind(res) as typeof res.write;
  const originalEnd = res.end.bind(res) as typeof res.end;

  let compressor: zlib.Gzip | zlib.BrotliCompress | null = null;
  let decided = false;
  let skipped = false;

  function activate(): void {
    if (decided) return;
    decided = true;

    if (res.headersSent || !isCompressible(res)) {
      skipped = true;
      return;
    }

    compressor =
      encoding === "br"
        ? zlib.createBrotliCompress({
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
          })
        : zlib.createGzip({ level: 6 });

    res.setHeader("Content-Encoding", encoding);
    res.removeHeader("Content-Length");

    compressor.on("data", (chunk: Buffer) => {
      originalWrite(chunk as unknown as string);
    });

    compressor.on("error", (err: Error) => {
      console.warn(`[compression] ${encoding} error — falling back:`, err.message);
      skipped = true;
      compressor = null;
    });
  }

  (res as any).write = function (
    chunk: any,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean {
    activate();
    if (compressor && !skipped) {
      if (typeof encodingOrCb === "function") {
        compressor.write(chunk, encodingOrCb);
      } else {
        compressor.write(chunk, encodingOrCb, callback);
      }
      return true;
    }
    return (originalWrite as any)(chunk, encodingOrCb, callback);
  };

  (res as any).end = function (
    chunk?: any,
    encodingOrCb?: BufferEncoding | (() => void),
    callback?: () => void,
  ): Response {
    activate();

    if (compressor && !skipped) {
      const cb =
        typeof encodingOrCb === "function"
          ? encodingOrCb
          : (callback as (() => void) | undefined);

      if (chunk != null && chunk !== "") {
        compressor.write(chunk);
      }

      compressor.end(() => {
        (originalEnd as any).call(res);
        cb?.();
      });
    } else {
      (originalEnd as any).call(res, chunk, encodingOrCb, callback);
    }

    return res;
  };

  next();
}
