export function formatMoney(n) {
  return "K" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d.includes("T") || d.includes(" ") ? d : d + "T00:00:00");
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d) {
  if (!d) return "—";
  const date = new Date(d.replace(" ", "T") + "Z");
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function expiryStatus(daysRemaining) {
  if (daysRemaining == null) return { label: "No expiry set", tone: "gray" };
  if (daysRemaining < 0) return { label: "Expired", tone: "red" };
  if (daysRemaining <= 14) return { label: `${daysRemaining}d left`, tone: "red" };
  if (daysRemaining <= 60) return { label: `${daysRemaining}d left`, tone: "amber" };
  return { label: `${daysRemaining}d left`, tone: "green" };
}
