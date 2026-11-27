// Shared error response for route handlers. Server-only.
import { dbErrorReason } from "./db";
import { retrySetup, setupStatus } from "./db-setup";

/**
 * Logs the full error on the server and returns a 503 the customer can understand.
 * `reason` is only an error code (e.g. ECONNREFUSED), safe to show; it tells the
 * owner what to fix without exposing hosts, users or passwords.
 */
export function serverTrouble(where: string, e: unknown): Response {
  let reason = dbErrorReason(e);
  // Tables missing: the startup setup didn't finish. Try again in the background
  // and show its last result (a code only) so the owner can see why.
  if (reason.startsWith("ER_NO_SUCH_TABLE")) {
    retrySetup();
    reason += ` setup=${setupStatus()}`;
  }
  console.error(`[${where}] ${reason}:`, e instanceof Error ? e.message : e);
  return Response.json(
    {
      message: `সার্ভারে সাময়িক সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন, অথবা হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন। (কারণ: ${reason})`,
      reason,
    },
    { status: 503 },
  );
}
