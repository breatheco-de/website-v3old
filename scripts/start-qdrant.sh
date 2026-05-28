#!/usr/bin/env bash
set -euo pipefail

QDRANT_VERSION="v1.13.4"
BIN_DIR=".local/bin"
QDRANT_BIN="${BIN_DIR}/qdrant"
STORAGE_DIR=".cache/qdrant-storage"
MODEL_CACHE_DIR=".cache/xenova-models"

mkdir -p "${BIN_DIR}" "${STORAGE_DIR}" "${MODEL_CACHE_DIR}"

if [ ! -f "${QDRANT_BIN}" ]; then
  echo "[qdrant] Binary not found — downloading ${QDRANT_VERSION} for Linux x86_64..."
  TMP_DIR=$(mktemp -d)
  ARCHIVE="${TMP_DIR}/qdrant.tar.gz"
  URL="https://github.com/qdrant/qdrant/releases/download/${QDRANT_VERSION}/qdrant-x86_64-unknown-linux-musl.tar.gz"
  curl -fsSL -o "${ARCHIVE}" "${URL}"
  tar -xzf "${ARCHIVE}" -C "${TMP_DIR}"
  mv "${TMP_DIR}/qdrant" "${QDRANT_BIN}"
  chmod +x "${QDRANT_BIN}"
  rm -rf "${TMP_DIR}"
  echo "[qdrant] Downloaded to ${QDRANT_BIN}"
fi

echo "[embedding-model] Warming up local embedding model (Xenova/all-MiniLM-L6-v2)..."
node --input-type=module <<'EOF'
import { pipeline, env } from "@xenova/transformers";
env.allowLocalModels = false;
env.cacheDir = ".cache/xenova-models";
try {
  await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  console.log("[embedding-model] Model ready.");
} catch (err) {
  console.warn("[embedding-model] Warmup failed (search will fall back to keyword):", err.message);
}
EOF

echo "[qdrant] Starting on port 6333 with storage at ${STORAGE_DIR}..."
export QDRANT__SERVICE__HTTP_PORT=6333
export QDRANT__STORAGE__STORAGE_PATH="${STORAGE_DIR}"
exec "${QDRANT_BIN}"
