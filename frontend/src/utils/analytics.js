export const trackEvent = (eventName, payload = {}) => {
  if (typeof window === "undefined") return;
  const name = String(eventName || "").trim();
  if (!name) return;

  const data = payload && typeof payload === "object" ? payload : {};

  try {
    window.dispatchEvent(
      new CustomEvent("app:analytics", {
        detail: { event: name, ...data },
      })
    );
  } catch {
    // no-op
  }

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, data);
    }
  } catch {
    // no-op
  }

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...data });
    }
  } catch {
    // no-op
  }
};
