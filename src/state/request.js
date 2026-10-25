export async function fetchWithDeadline(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    // Consume bodies before releasing the deadline: a stalled body also times out.
    const bytes = await response.arrayBuffer();
    return new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The request timed out. Check your connection and try again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
