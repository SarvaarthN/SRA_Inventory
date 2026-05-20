"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RefreshOnMount() {
  const router = useRouter();
  
  useEffect(() => {
    // 1. Refresh instantly on mount to clear any local navigation cache
    router.refresh();

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          // Only refresh if the browser tab is actively in focus / visible
          if (document.visibilityState === "visible") {
            router.refresh();
          }
        }, 10000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // 2. Start polling if page is visible initially
    if (document.visibilityState === "visible") {
      startPolling();
    }

    // 3. Listen for visibility changes (tab active/inactive)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // Refresh immediately when user returns to tab
        startPolling();
      } else {
        stopPolling(); // Pause all polling when tab goes to background
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return null;
}
