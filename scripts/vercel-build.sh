#!/bin/bash
set -e

echo "==> Building api-server..."
pnpm --filter @workspace/api-server run build

echo "==> Building frontend..."
pnpm --filter @workspace/barber-artist run build

echo "==> Creating Vercel Build Output API v3 structure..."
rm -rf .vercel/output
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions/api/index.func

# Copy frontend static files to CDN output
cp -r artifacts/barber-artist/dist/public/. .vercel/output/static/

# Copy api-server function
cp artifacts/api-server/api/index.js .vercel/output/functions/api/index.func/index.js

# Function config
cat > .vercel/output/functions/api/index.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs22.x",
  "handler": "index.js",
  "launcherType": "Nodejs",
  "maxDuration": 60
}
EOF

# Routing config: /api/* -> function, everything else -> static + SPA fallback
cat > .vercel/output/config.json << 'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF

echo "==> Build complete!"
