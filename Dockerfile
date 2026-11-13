# syntax=docker/dockerfile:1

# ---- deps: ติดตั้ง dependencies ทั้งหมด (รวม dev) สำหรับ build ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall = prisma generate (ต้องมี prisma/schema.prisma)
RUN npm ci

# ---- builder: build Next.js (standalone) และ bundle สคริปต์ seed ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build
# รวม prisma/seed.ts เป็นไฟล์เดียว (ไม่ต้องมี tsx ใน image สุดท้าย); @prisma/client มีอยู่แล้วใน runtime
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=cjs \
      --external:@prisma/client --outfile=seed.cjs

# ---- prisma-cli: ติดตั้ง Prisma CLI แยก สำหรับ `migrate deploy` ตอนเริ่มระบบ ----
# standalone output ไม่รวม CLI จึงติดตั้งเฉพาะ prisma (เวอร์ชันตรงกับ lockfile) ไว้ที่ /prisma-cli
FROM node:22-alpine AS prisma-cli
RUN apk add --no-cache openssl
WORKDIR /prisma-cli
COPY package-lock.json /tmp/package-lock.json
RUN PRISMA_VERSION=$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version") \
    && npm init -y >/dev/null \
    && npm install --omit=dev --no-audit --no-fund "prisma@${PRISMA_VERSION}"

# ---- runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads \
    CHECKPOINT_DISABLE=1

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/seed.cjs ./seed.cjs
# Prisma client ที่ generate แล้ว (query engine) ให้แน่ใจว่าอยู่ครบ
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Prisma CLI สำหรับ migrate deploy (อยู่นอก node_modules ของแอปเพื่อไม่ชนกับไฟล์ที่ standalone trace มา)
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma-cli/node_modules /prisma-cli/node_modules
ENV PATH="/prisma-cli/node_modules/.bin:${PATH}"

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
    && mkdir -p /data/uploads && chown -R nextjs:nodejs /data

USER nextjs
VOLUME ["/data/uploads"]
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
