-- 0001_init_roles.sql
-- Enum types for system + workspace roles. Enums live in the DB (not code);
-- changing them requires a new migration.

create type system_role as enum ('user', 'admin');
create type workspace_role as enum ('owner', 'member');
