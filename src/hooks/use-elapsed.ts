"use client";

import { useEffect, useState } from "react";

export function useElapsed(startedAt?: string, pausedAt?: string, pausedSeconds = 0) {
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  if (!startedAt) return 0;
  const end = pausedAt ? new Date(pausedAt).getTime() : now;
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000) - pausedSeconds);
}
