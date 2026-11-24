// Adds the fictional showcase accounts to the configured database so Matches
// is populated for a demo. Safe to re-run and safe while the server is
// running: the server reloads the database when its revision moves on.
//   npm run seed:showcase
import { configuration } from "../server/config.js";
import { createStorage } from "../server/storage.js";
import {
  seedShowcase,
  showcaseEmail,
  showcasePassword,
} from "../server/showcase.js";
import { demoProfiles } from "../server/demo-directory.js";

const { file } = configuration();
const storage = createStorage(file);
try {
  const db = storage.load();
  if (db.version !== 1 || !db.accounts)
    throw new Error("Unsupported workspace database. Nothing was changed.");
  const added = seedShowcase(db.accounts);
  if (added) {
    const expected = db.revision;
    db.revision += 1;
    storage.commit(db, expected);
  }
  console.log(`${file}: added ${added} showcase account(s).\n`);
  for (const role of ["mentor", "founder"]) {
    console.log(role === "mentor" ? "Mentors" : "Startups");
    for (const sample of demoProfiles.filter((item) => item.role === role))
      console.log(`  ${sample.name.padEnd(18)} ${showcaseEmail(sample)}`);
    console.log("");
  }
  console.log(`Password for every showcase account: ${showcasePassword}`);
} finally {
  storage.close();
}
