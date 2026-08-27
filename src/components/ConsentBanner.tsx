import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const STORAGE_KEY = "cookie_consent";
const REOPEN_KEY = "cookie_consent_reopen";
const CONSENT_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO",
  "GB", "CH", "CA",
];

export async function isConsentRequiredRegion(): Promise<boolean> {
  try {
    const res = await fetch("/cdn-cgi/trace", { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return true;
    const country = (await res.text()).match(/^loc=([A-Z0-9]{2})$/m)?.[1];
    if (!country || country === "XX" || country === "T1") return true;
    return CONSENT_COUNTRIES.includes(country);
  } catch {
    return true;
  }
}

export async function hasAdConsent(): Promise<boolean> {
  const choice = localStorage.getItem(STORAGE_KEY);
  if (choice) return choice === "granted";
  if (sessionStorage.getItem(REOPEN_KEY)) return false;
  return !(await isConsentRequiredRegion());
}

export function reopenConsentBanner() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.setItem(REOPEN_KEY, "1");
  location.reload();
}

function updateConsent(decision: "granted" | "denied") {
  window.gtag?.("consent", "update", {
    ad_storage: decision,
    ad_user_data: decision,
    ad_personalization: decision,
    analytics_storage: decision,
  });
}

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "granted" || saved === "denied") {
      updateConsent(saved);
      return;
    }
    if (sessionStorage.getItem(REOPEN_KEY)) {
      setShow(true);
      return;
    }
    let cancelled = false;
    void isConsentRequiredRegion().then((required) => {
      if (required && !cancelled) setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const decide = (decision: "granted" | "denied") => {
    localStorage.setItem(STORAGE_KEY, decision);
    sessionStorage.removeItem(REOPEN_KEY);
    updateConsent(decision);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-border bg-card/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Usamos cookies para medir anúncios e entender como o Movie Match é usado.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => decide("denied")}>
          Recusar
        </Button>
        <Button size="sm" onClick={() => decide("granted")}>
          Aceitar
        </Button>
      </div>
    </div>
  );
}
