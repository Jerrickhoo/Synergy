export function profileText(value) {
  return String(value || "").trim();
}

export function profileEntries(value) {
  return (Array.isArray(value) ? value : String(value || "").split(/[,;\n]/))
    .map(profileText)
    .filter(Boolean);
}

export function normalizeProfile(values) {
  const result = { ...values };
  for (const key of ["offer", "need", "offerTags", "needTags"])
    if (key in result)
      result[key] = Array.isArray(result[key])
        ? profileEntries(result[key]).join(", ")
        : String(result[key] || "")
            .split(/[,;]/)
            .map(profileText)
            .filter((entry) => profileEntries(entry).length)
            .join(", ");
  if ("bio" in result) result.bio = profileText(result.bio);
  return result;
}
