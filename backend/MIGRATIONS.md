# Database Migrations

This project uses [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) for database schema version control.

## How It Works

- Migrations run automatically when the backend starts
- Migration files are in `/backend/migrations/`
- Migration history is tracked in the `pgmigrations` table

## Creating a New Migration

```bash
npm run migrate:create <migration-name>
```

Example:
```bash
npm run migrate:create add-watched-column
```

This creates a new migration file in `migrations/` with a timestamp prefix.

## Manual Migration Commands

Run all pending migrations:
```bash
npm run migrate:up
```

Rollback the last migration:
```bash
npm run migrate:down
```

## Migration File Structure

```javascript
/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Changes to apply
  pgm.addColumn('movies', {
    watched: {
      type: 'boolean',
      default: false,
    },
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  // Changes to rollback
  pgm.dropColumn('movies', 'watched');
};
```

## Environment Variables

Migrations use the same database connection settings as the application:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## Best Practices

1. **Never modify existing migrations** - Create new ones instead
2. **Always include a `down` migration** - For rollback capability
3. **Test migrations locally first** - Before deploying to production
4. **Keep migrations small** - One logical change per migration
5. **Use transactions** - Migrations are wrapped in transactions by default
