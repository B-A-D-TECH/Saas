# TODO (blackboxai)

- [ ] Step 1: Fix PostgreSQL TypeScript issue (pg types) by adding @types/pg if required and updating server/pg.ts.
- [ ] Step 2: Run `npm run build` and ensure there are no pg-related TS errors.
- [ ] Step 3: Audit SQLite usage across the project (node:sqlite / sqlite / DatabaseSync / initDb / db.ts) and list all dependent files.
- [ ] Step 4: After PostgreSQL startup is verified, remove SQLite dependencies only if no references remain.
- [ ] Step 5: Run final `npm run build` and report remaining TS errors.

