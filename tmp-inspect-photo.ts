import { getDb, allRows } from "./src/lib/database.js";

async function main() {
  const db = await getDb();
  const rows = allRows(db, "SELECT id, photoUrl FROM reports WHERE source = ?", ["google-sheets"]);
  const multi = rows.filter((r: any) => typeof r.photoUrl === 'string' && r.photoUrl.includes(','));
  const timestamps = rows.filter((r: any) => typeof r.photoUrl === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(r.photoUrl) && !r.photoUrl.startsWith('http'));
  const driveOpen = rows.filter((r: any) => typeof r.photoUrl === 'string' && r.photoUrl.includes('drive.google.com/open?id='));
  const driveFile = rows.filter((r: any) => typeof r.photoUrl === 'string' && r.photoUrl.includes('drive.google.com/file/d/'));
  const otherHttp = rows.filter((r: any) => typeof r.photoUrl === 'string' && r.photoUrl.startsWith('http') && !r.photoUrl.includes('drive.google.com'));
  
  console.log(`Total Google Sheets reports: ${rows.length}`);
  console.log(`Multi-photo (comma-separated): ${multi.length}`);
  console.log(`Drive open?id=: ${driveOpen.length}`);
  console.log(`Drive file/d/: ${driveFile.length}`);
  console.log(`Timestamps: ${timestamps.length}`);
  console.log(`Other HTTP: ${otherHttp.length}`);
  console.log(`Placeholder/empty: ${rows.length - multi.length - driveOpen.length - driveFile.length - timestamps.length - otherHttp.length}`);
  
  console.log("\n--- Sample timestamps ---");
  timestamps.slice(0, 5).forEach((r: any) => console.log(r.id, r.photoUrl));
  
  console.log("\n--- Sample multi-photo ---");
  multi.slice(0, 5).forEach((r: any) => console.log(r.id, r.photoUrl));
  
  console.log("\n--- Sample drive open?id= ---");
  driveOpen.slice(0, 5).forEach((r: any) => console.log(r.id, r.photoUrl));
  
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
