#!/bin/sh
# Entrypoint for the db-backup service.
# Sets up a cron job to run pg_dump on a schedule, then runs crond in the foreground.
# Env vars (all required unless defaulted):
#   PGHOST, PGDATABASE, PGUSER, PGPASSWORD  — postgres connection (standard libpq vars)
#   BACKUP_CRON                              — cron schedule (default: "0 2 * * *" = 2am daily)
#   BACKUP_KEEP_DAYS                         — days of backups to retain (default: 7)

set -e

BACKUP_DIR="/backups"
BACKUP_CRON="${BACKUP_CRON:-0 2 * * *}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

# Write the backup script that crond will invoke
cat > /usr/local/bin/run-backup.sh << 'EOF'
#!/bin/sh
set -e
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="movienight_${DATE}.sql.gz"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup..."

if pg_dump --clean --if-exists | gzip > "${BACKUP_DIR}/${FILENAME}"; then
  SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete: ${FILENAME} (${SIZE})"
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: pg_dump failed" >&2
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

# Remove backups older than BACKUP_KEEP_DAYS
find "${BACKUP_DIR}" -name "movienight_*.sql.gz" -mtime "+${BACKUP_KEEP_DAYS}" -delete
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pruned backups older than ${BACKUP_KEEP_DAYS} days"
EOF
chmod +x /usr/local/bin/run-backup.sh

# Register the cron job under root's crontab
echo "${BACKUP_CRON} /usr/local/bin/run-backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

echo "Backup schedule: ${BACKUP_CRON}"
echo "Retention: ${BACKUP_KEEP_DAYS} days"
echo "Target: ${BACKUP_DIR}"

# Run an initial backup on container start so there's always at least one
echo "Running initial backup on startup..."
/usr/local/bin/run-backup.sh

# Hand off to crond in foreground (-f) with log level 2 (errors + warnings)
exec crond -f -l 2
