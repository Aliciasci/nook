#!/usr/bin/env bash
# Deploy Nook to Railway.
#
# Railway's uploader fails from this repo's location on the Windows drvfs
# mount (/mnt/c/...) with:
#   header key "exclude-patterns" contains value with non-printable ASCII
# Staging a copy on the Linux filesystem first sidesteps it, so always
# deploy through this script rather than calling `railway up` directly.
set -euo pipefail

PROJECT_ID=91627e32-4d2d-4fc4-bd2f-7004d5591f2a
SERVICE=nook
STAGE=/tmp/nook-deploy

cd "$(dirname "$0")"

rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -cf - --exclude=node_modules --exclude=dist --exclude=.git \
          --exclude='.env.bak' . | (cd "$STAGE" && tar -xf -)

cd "$STAGE"
railway up --ci \
  --project "$PROJECT_ID" \
  --environment production \
  --service "$SERVICE"
