#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running db:migrate..."
  yarn medusa db:migrate
fi

if [ -n "${CREATE_ADMIN_EMAIL:-}" ] && [ -n "${CREATE_ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] Ensuring admin user ${CREATE_ADMIN_EMAIL} exists..."
  yarn medusa user -e "${CREATE_ADMIN_EMAIL}" -p "${CREATE_ADMIN_PASSWORD}" || \
    echo "[entrypoint] admin user already exists, skipping"
fi

exec "$@"
