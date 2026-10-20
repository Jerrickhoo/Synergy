// Keep Set-backed selections intact across the API and the on-disk workspace.
export const encode = (value) =>
  JSON.stringify(value, (_key, item) =>
    item instanceof Set ? { $set: [...item] } : item,
  );
export const decode = (value) =>
  JSON.parse(value, (_key, item) =>
    item && typeof item === "object" && Array.isArray(item.$set)
      ? new Set(item.$set)
      : item,
  );
