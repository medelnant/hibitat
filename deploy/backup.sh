#!/usr/bin/env bash
# Nightly Postgres dump, installed on the VPS as /root/hibitat/backup.sh and run by root's crontab:
#   15 3 * * * /root/hibitat/backup.sh
# Keeps 14 days of compressed dumps in /root/db-backups.
set -euo pipefail
out="/root/db-backups/hibitat.$(date +%Y%m%d-%H%M).sql.gz"
docker compose -f /root/hibitat/compose.yml exec -T db pg_dump -U hibitat -d hibitat | gzip > "$out"
chmod 600 "$out"
find /root/db-backups -name 'hibitat.*.sql.gz' -mtime +14 -delete
