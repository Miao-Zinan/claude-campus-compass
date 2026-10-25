export type AiRouteResult = {
  status?: string;
  message?: string;
  limit?: "minute" | "daily";
  retryable?: boolean;
};

/** User message for request-guard responses (429 busy/rate limit, 503 paused/unavailable); null for other statuses. */
export function describeGuardFailure(httpStatus: number, result: AiRouteResult): string | null {
  if (httpStatus === 429) {
    if (result.status === "busy") {
      return result.message || "Another AI request is still being processed. Please wait a few seconds and try again.";
    }
    if (result.limit === "daily") return "The shared daily AI request limit has been reached. Please try again tomorrow.";
    if (result.limit === "minute") return "The shared short-term AI request limit has been reached. Please wait and try again.";
    return result.message || "Too many requests. Please wait and try again.";
  }
  if (httpStatus === 503) return result.message || "Live AI requests are temporarily paused.";
  return null;
}

export type TrackedRequest = {
  signal: AbortSignal;
  isCurrent: () => boolean;
};

/**
 * Tracks the latest request of one kind. Starting a request or cancelling aborts the
 * previous one; responses must check isCurrent() before changing any UI state.
 */
export function createLatestRequestTracker() {
  let current: AbortController | null = null;
  return {
    start(): TrackedRequest {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      return { signal: controller.signal, isCurrent: () => current === controller };
    },
    cancel() {
      current?.abort();
      current = null;
    },
  };
}
