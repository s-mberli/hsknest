import { Langfuse } from "langfuse";

// Initialize Langfuse only if we have the keys, preventing crashes in environments without it
export const langfuse = process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
  ? new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASEURL || "https://us.cloud.langfuse.com",
    })
  : null;

/**
 * Placeholder wrapper for future LLM calls (e.g. OpenAI/Anthropic).
 * The goal is to use this wrapper or an auto-instrumentation library 
 * (like langfuse-vercel or phoenix) to ensure every LLM call has an associated trace.
 */
export async function withTelemetry<T>(
  traceName: string,
  userId: string,
  fn: (traceId?: string) => Promise<T>
): Promise<T> {
  if (!langfuse) {
    // If telemetry isn't configured, just execute the function
    return fn();
  }

  const trace = langfuse.trace({
    name: traceName,
    userId: userId,
  });

  try {
    const result = await fn(trace.id);
    // Optionally update trace on success
    return result;
  } catch (error) {
    // In Langfuse, status messages are typically attached to spans or generations, not the root trace.
    // For now, we will simply throw the error.
    throw error;
  } finally {
    // Flush logs to ensure they're sent
    await langfuse.flushAsync();
  }
}
