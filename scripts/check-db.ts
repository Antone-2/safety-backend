import { getDb, allRows } from '../src/lib/database.js';

const db = await getDb();
const tables = allRows(db, "SELECT name FROM sqlite_master WHERE type='table'");
console.log('Tables:', tables.map((t: any) => t.name).join(', '));

const counts: Record<string, number> = {};
for (const t of tables) {
  counts[t.name] = allRows(db, 'SELECT COUNT(*) as c FROM ' + t.name)[0].c;
}
console.log('Row counts:', JSON.stringify(counts, null, 2));
