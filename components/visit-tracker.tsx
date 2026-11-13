"use client";

import { useEffect } from "react";

const VISIT_KEY = "nv_visit_counted";

export function VisitTracker() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(VISIT_KEY)) return;
      window.sessionStorage.setItem(VISIT_KEY, "1");
    } catch {
      // Proceed if sessionStorage is unavailable.
    }

    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {
      // Ignore telemetry failures.
    });
  }, []);

  return null;
}

