#!/usr/bin/env bash
set -euo pipefail

PNPM_VERSION="10.29.3"

corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

pnpm install --frozen-lockfile --prefer-offline

