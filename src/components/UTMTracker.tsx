"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UTMTrackerInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;

    const source = searchParams.get("utm_source") || searchParams.get("ref");
    const campaign = searchParams.get("utm_campaign");

    if (source) {
      localStorage.setItem("hsknest-utm-source", source);
    }
    if (campaign) {
      localStorage.setItem("hsknest-utm-campaign", campaign);
    }
  }, [searchParams]);

  return null;
}

export function UTMTracker() {
  return (
    <Suspense fallback={null}>
      <UTMTrackerInner />
    </Suspense>
  );
}
