import { getDb, allRows } from "./src/lib/database.js";

async function main() {
  const db = await getDb();
  console.log(allRows(db, "SELECT * FROM migrations ORDER BY id"));
  console.log(allRows(db, "PRAGMA table_info(users)"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
