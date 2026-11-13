#!/bin/sh
set -e

echo "รัน database migration..."
prisma migrate deploy

echo "เริ่มเซิร์ฟเวอร์..."
exec node server.js
