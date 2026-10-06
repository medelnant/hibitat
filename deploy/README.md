# Deploying HIBITAT

Lives at **https://hibitat.visualaesthetic.com** on the Hostinger VPS (`ssh hostinger-stage`),
next to the portfolio and passkey sites. Private preview: nginx basic auth, `noindex`.

```
browser ─https─▶ nginx (basic auth, TLS) ─▶ 127.0.0.1:3002  PM2 "hibitat" (next start)
                                                 │
                                                 └─▶ 127.0.0.1:5432  Docker "hibitat-db-1" (Postgres 17)
```

## Shipping an update

```bash
git push
./deploy/deploy.sh
```

The script pulls `main` on the server, runs `npm ci`, applies migrations, builds (the build reads
from Postgres, so the database must be up, and the script makes sure it is) and reloads PM2.

## Where things are on the VPS

| What | Where |
|---|---|
| App checkout | `/var/www/hibitat` (cloned from GitHub via the `github-hibitat` SSH alias) |
| App env | `/var/www/hibitat/.env.local` (`DATABASE_URL`) |
| Postgres | `/root/hibitat/compose.yml`, password in `/root/hibitat/.env` |
| Basic auth login | `/root/hibitat/basic-auth.txt` (hash in `/etc/nginx/.htpasswd-hibitat`) |
| nginx site | `/etc/nginx/sites-available/hibitat` (source: `deploy/nginx-hibitat.conf`) |
| Backups | `/root/db-backups/hibitat.*.sql.gz`, nightly at 03:15 by `/root/hibitat/backup.sh`, 14 days kept |
| GitHub deploy key | `/root/.ssh/hibitat_deploy` (read-only key on the repo) |

## Handy commands (on the VPS)

```bash
pm2 logs hibitat                       # app logs
pm2 restart hibitat
cat /root/hibitat/basic-auth.txt       # site login
docker compose -f /root/hibitat/compose.yml exec db psql -U hibitat   # SQL shell
gunzip -c /root/db-backups/hibitat.<stamp>.sql.gz | docker compose -f /root/hibitat/compose.yml exec -T db psql -U hibitat   # restore
```

Change the site password: `htpasswd -c /etc/nginx/.htpasswd-hibitat hibitat` (needs `apache2-utils`),
or `openssl passwd -apr1`, then update `basic-auth.txt`.

## First-time setup (done 2026-10-06, kept for reference)

1. `/root/hibitat/` gets `compose.yml`, `backup.sh` and a generated `.env`; `docker compose up -d --wait`.
2. Basic auth file, crontab entry for `backup.sh`, deploy key plus `github-hibitat` host in `/root/.ssh/config`.
3. `deploy/nginx-hibitat.conf` → `/etc/nginx/sites-available/hibitat`, symlinked into `sites-enabled`, `nginx -t && systemctl reload nginx`.
4. DNS: Route 53 `A hibitat.visualaesthetic.com → 46.202.177.53`.
5. `git clone github-hibitat:<owner>/<repo>.git /var/www/hibitat`, write `.env.local`,
   `npm ci && npm run db:migrate && npm run db:seed && npm run build`, `pm2 start deploy/ecosystem.config.cjs && pm2 save`.
6. `certbot --nginx -d hibitat.visualaesthetic.com` (adds TLS and the HTTP→HTTPS redirect to the nginx site).
