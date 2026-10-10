# API agent guidance

Follow the shared [root AGENTS.md](../../AGENTS.md), the single source of truth for this project. Never run destructive database commands unless the effective database connection and target have been explicitly verified as disposable; `--env=testing` alone does not guarantee isolation. Use `MigrationSafetyTest` for migration and rollback verification. Local setup and checks are documented in the [project README](../../README.md).
