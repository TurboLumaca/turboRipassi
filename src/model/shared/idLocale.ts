/**
 * Model layer — identifiers minted on the device.
 *
 * Every row this app writes has a uuid primary key with a server-side default,
 * so until now the client never had to name anything: it inserted, and Postgres
 * answered with the id. That stops working the moment a ripasso can be saved
 * with no connection — it has to exist, be listed, be opened and carry
 * attachments hours before any server sees it.
 *
 * Minting the id here is also what makes the deferred write *idempotent*. The
 * queue retries, and a retry of a server-generated insert whose reply was lost
 * creates a second row; the same insert with the id already decided collides
 * with itself instead, which is a conflict the database can resolve and the app
 * can ignore. That is the whole reason `crea` was deliberately never retried.
 */
import * as Crypto from "expo-crypto";

/** What Postgres will accept in a `uuid` column. */
const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A v4 uuid, in the shape Postgres accepts for a `uuid` column.
 *
 * `expo-crypto` is backed by the platform CSPRNG. The fallback is not about
 * cryptography — nothing here is a secret — but about never returning a
 * malformed id: a value Postgres rejects would fail the insert at sync time,
 * long after the screen that produced it was closed, and with no way to repair
 * the queued entry. Math.random is a poor source of uniqueness and a fine
 * source of the right *shape*.
 *
 * The result is checked, not just the call. A native module that is missing —
 * under a test runner, in a build where autolinking dropped it — does not
 * necessarily throw: it can return undefined, and a try/catch would hand that
 * straight through as the primary key of everything the user saves offline.
 */
export function idLocale(): string {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === "string" && FORMA_UUID.test(id)) return id;
  } catch {
    // Fall through: an unusable module and a missing one are the same problem.
  }
  return uuidDiRipiego();
}

function uuidDiRipiego(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
