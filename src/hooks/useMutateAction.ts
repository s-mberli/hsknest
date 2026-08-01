"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface MutateActionOptions<T> {
  /** Called with the parsed JSON body once `res.ok`. Only awaited/parsed if provided. */
  onSuccess?: (data: T) => void;
  /** Toasted when the response is not ok. */
  errorMessage: string;
  /** Toasted when the fetch itself throws (network error). */
  catchMessage: string;
}

/**
 * Shared shape behind the list action buttons (Enroll/Assume/Unenroll/
 * Visibility): loading state → fetch → toast on failure or run `onSuccess` →
 * `router.refresh()` → toast on network error → always clear loading.
 * Success messaging and post-action state (e.g. a confirm step) differ per
 * button and stay in the caller.
 */
export function useMutateAction() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run<T = unknown>(
    fetcher: () => Promise<Response>,
    opts: MutateActionOptions<T>
  ): Promise<boolean> {
    setLoading(true);
    try {
      const res = await fetcher();
      if (!res.ok) {
        toast.error(opts.errorMessage);
        return false;
      }
      if (opts.onSuccess) {
        const data = (await res.json()) as T;
        opts.onSuccess(data);
      }
      router.refresh();
      return true;
    } catch {
      toast.error(opts.catchMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { loading, run };
}
