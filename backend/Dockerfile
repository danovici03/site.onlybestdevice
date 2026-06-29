# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json yarn.lock ./
RUN corepack enable \
 && corepack prepare yarn@4.12.0 --activate \
 && yarn config set nodeLinker node-modules \
 && yarn install --immutable --network-timeout 600000

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
ENV NODE_ENV=production

# Admin UI is compiled into .medusa/server/public/admin at build time.
# MEDUSA_ADMIN_BACKEND_URL is baked into the React bundle so the admin knows
# which API to call. DISABLE_MEDUSA_ADMIN must be false for admin to ship.
ARG MEDUSA_ADMIN_BACKEND_URL
ARG DISABLE_MEDUSA_ADMIN=false
ENV MEDUSA_ADMIN_BACKEND_URL=$MEDUSA_ADMIN_BACKEND_URL
ENV DISABLE_MEDUSA_ADMIN=$DISABLE_MEDUSA_ADMIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && yarn build
RUN echo "=== scripts compiled ===" \
 && ls -la /app/.medusa/server/src/scripts/ \
 && echo "=== csv-parse in node_modules ===" \
 && ls /app/node_modules/csv-parse 2>&1 | head -10

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl tini
ENV NODE_ENV=production

COPY --from=builder /app/.medusa/server ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && corepack enable \
 && corepack prepare yarn@4.12.0 --activate \
 && yarn config set nodeLinker node-modules \
 && yarn install --immutable --network-timeout 600000

EXPOSE 9000
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["yarn", "start"]
