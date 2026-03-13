#!/bin/bash
set -e

echo "Building client bundle..."
npx vite build

echo "Building SSR server bundle..."
npx vite build --ssr

echo "Building Express server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Build complete."
