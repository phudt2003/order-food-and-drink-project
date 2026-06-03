const toSafeString = (value) => String(value || "").trim();

const slugify = (value) => {
  const text = toSafeString(value).toLowerCase();
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export const normalizeToppingSelections = (toppingsRaw) => {
  if (typeof toppingsRaw === "string") {
    const parts = toppingsRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return normalizeToppingSelections(parts);
  }

  if (!Array.isArray(toppingsRaw)) return [];

  const selectionMap = new Map();

  toppingsRaw.forEach((item) => {
    if (!item) return;

    if (typeof item === "string") {
      const name = item.trim();
      if (!name) return;

      const toppingId = slugify(name) || name;

      const existing = selectionMap.get(toppingId);
      if (existing) {
        existing.quantity += 1;
      } else {
        selectionMap.set(toppingId, { toppingId, name, quantity: 1 });
      }
      return;
    }

    if (typeof item === "object") {
      const rawId = toSafeString(item?.toppingId || item?.id || item?.name || item?.toppingName);
      const rawName = toSafeString(item?.name || item?.toppingName);
      const toppingId = slugify(rawId) || slugify(rawName) || rawId || rawName;
      if (!toppingId) return;

      const quantityRaw = Number(item?.quantity ?? 1);
      const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.round(quantityRaw)) : 1;
      const name = rawName || rawId || toppingId;

      const existing = selectionMap.get(toppingId);
      if (existing) {
        existing.quantity += quantity;
        if (!existing.name && name) existing.name = name;
      } else {
        selectionMap.set(toppingId, { toppingId, name, quantity });
      }
    }
  });

  return Array.from(selectionMap.values()).sort((a, b) => String(a.toppingId).localeCompare(String(b.toppingId)));
};

export const toppingsKeyPart = (toppingsRaw) =>
  normalizeToppingSelections(toppingsRaw)
    .map((item) => `${item.toppingId}:${item.quantity}`)
    .join(",");

export const formatToppingsInline = (toppingsRaw) => {
  const selections = normalizeToppingSelections(toppingsRaw);
  if (selections.length === 0) return "";
  return selections.map((item) => `${item.name} x${item.quantity}`).join(", ");
};
