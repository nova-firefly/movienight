#!/bin/sh
# Restore a movienight database backup.
# Usage:
#   ./scripts/restore.sh <backup-file.sql.gz>
#
# The backup file can be:
#   - A path to a .sql.gz file on the host, OR
#   - A filename inside the db_backups Docker volume (e.g. movienight_20260330_020000.sql.gz)
#
# Examples:
#   ./scripts/restore.sh movienight_20260330_020000.sql.gz
#   ./scripts/restore.sh /tmp/movienight_20260330_020000.sql.gz
#   ./scripts/restore.sh latest  # restores the most recent backup from the volume

set -e

BACKUP_FILE="${1:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz|latest>"
  echo ""
  echo "List available backups:"
  echo "  docker run --rm -v movienight_db_backups:/backups alpine ls -lh /backups"
  exit 1
fi

# Resolve 'latest' to the most recent backup in the volume
if [ "$BACKUP_FILE" = "latest" ]; then
  echo "Finding the latest backup in the db_backups volume..."
  BACKUP_FILE=$(docker run --rm \
    -v movienight_db_backups:/backups \
    alpine sh -c "ls /backups/movienight_*.sql.gz 2>/dev/null | sort | tail -1" 2>/dev/null || true)

  if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: No backups found in the db_backups volume." >&2
    exit 1
  fi
  echo "Using: $BACKUP_FILE"
fi

# Determine if the file is on the host or inside the volume
if [ -f "$BACKUP_FILE" ]; then
  # Host file — mount it directly
  ABS_PATH=$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")
  echo "Restoring from host file: $ABS_PATH"
  docker run --rm \
    --network movienight-network \
    -e PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD}}" \
    -v "${ABS_PATH}:/backup.sql.gz:ro" \
    postgres:15-alpine \
    sh -c "gunzip -c /backup.sql.gz | psql -h db -U \"\${PGUSER:-${POSTGRES_USER:-${DB_USER}}}\" \"\${PGDATABASE:-${POSTGRES_DB:-${DB_NAME}}}\""
else
  # Assume it's a filename inside the volume
  BASENAME=$(basename "$BACKUP_FILE")
  echo "Restoring from volume backup: $BASENAME"
  docker run --rm \
    --network movienight-network \
    -e PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD}}" \
    -v movienight_db_backups:/backups:ro \
    postgres:15-alpine \
    sh -c "gunzip -c \"/backups/${BASENAME}\" | psql -h db -U \"\${PGUSER:-${POSTGRES_USER:-${DB_USER}}}\" \"\${PGDATABASE:-${POSTGRES_DB:-${DB_NAME}}}\""
fi

echo ""
echo "Restore complete."
