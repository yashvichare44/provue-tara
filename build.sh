#!/bin/bash

# Vercel Build Script
# This script runs during Vercel deployment

echo "📦 Tara Finance Agent - Build Step"
echo "==================================="

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run TypeScript compilation check
echo "Checking TypeScript..."
npx tsc --noEmit

# Copy public files if needed
echo "Setting up static files..."
mkdir -p .vercel/output/static
cp -r public/* .vercel/output/static/ 2>/dev/null || true

echo "✓ Build completed successfully!"
