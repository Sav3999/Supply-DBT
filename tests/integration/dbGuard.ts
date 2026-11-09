/** Throws unless the database name in the connection URL ends with `_test`. */
export function assertTestDatabaseUrl(url: string | undefined): void {
  let name = "";
  try {
    name = new URL(url ?? "").pathname.replace(/^\//, "");
  } catch {
    // fall through: unparsable URL is refused
  }
  if (!name.endsWith("_test")) {
    throw new Error("Refusing to reset a database whose name does not end with _test");
  }
}
