/**
 * Auth module schema.
 * Auth uses the `users` table — this file re-exports the relevant parts
 * so the auth module doesn't import directly from the users module's internals.
 */
export { users, userRoleEnum } from "../users/users.schema.js";
export type { SelectUser, InsertUser } from "../users/users.schema.js";
