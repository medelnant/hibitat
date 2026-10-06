#!/usr/bin/env bash
# Ships whatever is pushed to GitHub: pull, install, migrate, build, restart.
# Run from your Mac after `git push`:  ./deploy/deploy.sh
set -euo pipefail

HOST="${HIBITAT_HOST:-hostinger-stage}"
BRANCH="${HIBITAT_BRANCH:-main}"

ssh "$HOST" BRANCH="$BRANCH" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/hibitat
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --hard --quiet "origin/$BRANCH"
echo "deploying $(git log -1 --format='%h %s')"
docker compose -f /root/hibitat/compose.yml up -d --wait
npm ci --no-audit --no-fund
npm run db:migrate
npm run build
pm2 reload hibitat --update-env || pm2 start deploy/ecosystem.config.cjs
pm2 save --force >/dev/null
echo "done: https://hibitat.visualaesthetic.com"
REMOTE
