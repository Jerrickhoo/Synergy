// Names the parts of a profile a save changed, for Recent activity:
// "You updated your description, industry and needs."
const founderNames = {
  name: "name",
  startupName: "startup name",
  bio: "description",
  industry: "industry",
  stage: "stage",
  teamSize: "team size",
  need: "needs",
  offer: "offers",
};
const mentorNames = {
  name: "name",
  bio: "bio",
  expertise: "expertise",
  startups: "startup interests",
  offer: "offer",
  need: "requests to founders",
  topics: "expertise tags",
  pastExperience: "past experience",
};
const text = (value) => String(value ?? "").trim();
// Tags are stored with the wording they replace, so a reordered list of the
// same tags is not a change.
const entries = (value) =>
  text(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");

export function profileChanges(before = {}, values = {}, role, accountName) {
  const names = role === "founder" ? founderNames : mentorNames;
  const changed = [];
  for (const [key, label] of Object.entries(names)) {
    if (!(key in values)) continue;
    const previous = key === "name" ? accountName : before[key];
    const same = ["need", "offer", "topics"].includes(key)
      ? entries(previous) === entries(values[key])
      : text(previous) === text(values[key]);
    if (!same && !changed.includes(label)) changed.push(label);
  }
  // A new upload arrives as image data; an empty value removes the photo.
  const photos =
    role === "founder"
      ? [
          ["image", "logo"],
          ["personImage", "photo"],
        ]
      : [["image", "photo"]];
  for (const [key, label] of photos) {
    if (!(key in values)) continue;
    const value = text(values[key]);
    if (value.startsWith("data:") || (!value && text(before[key])))
      changed.push(label);
  }
  return changed;
}

export function profileChangeText(changed) {
  if (!changed.length) return "You saved your profile without changes.";
  const list =
    changed.length === 1
      ? changed[0]
      : `${changed.slice(0, -1).join(", ")} and ${changed.at(-1)}`;
  return `You updated your ${list}.`;
}
