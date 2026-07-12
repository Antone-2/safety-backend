import { getDb, allRows } from '../src/lib/database.js';

const db = await getDb();
const users = allRows(db, 'SELECT id, email, name, role FROM users');
console.log('Users:', JSON.stringify(users, null, 2));

const reports = allRows(db, 'SELECT id, date, location, reporter, severity, status FROM reports LIMIT 5');
console.log('Sample reports:', JSON.stringify(reports, null, 2));
