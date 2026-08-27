const SIGNUP_SEND_TO = "AW-18412715129/7vNiCI3LyOgcEPn47stE";

/** Reports a completed Movie Match signup to Google Ads. */
export function reportSignupConversion() {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "conversion", {
    send_to: SIGNUP_SEND_TO,
    value: 1.0,
    currency: "BRL",
  });
}
