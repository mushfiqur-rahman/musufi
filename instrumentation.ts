// Runs once when the Next.js server starts (before it serves requests).
// Brings the database schema up to date and fills an empty shop with the
// starter catalogue, so a fresh deploy needs no manual database step.
// See lib/db-setup.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { setupDatabase } = await import("./lib/db-setup");
  await setupDatabase();
}
