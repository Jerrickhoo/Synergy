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
      throw Object.assign(
        new Error(
          "The request timed out. Check your connection and try again.",
        ),
        { connectionIssue: true },
      );
    throw Object.assign(error, { connectionIssue: true });
  } finally {
    clearTimeout(timer);
  }
}
