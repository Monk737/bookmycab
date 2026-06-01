/**
 * Builds an INTERNAL deep link into the n8n automation engine editor for a given
 * workflow. STAFF-ONLY: the engine (n8n) is never named or exposed on any
 * customer-facing surface — these links are rendered only inside the FlowMo admin
 * console. This is a pure string builder; it performs NO network calls.
 *
 * n8n editor URL shape:
 *   - workflow:           `${base}/workflow/${workflowId}`
 *   - project + workflow: `${base}/projects/${projectId}/workflow/${workflowId}`
 *
 * Returns `null` when no deeplink can be constructed — i.e. when the base URL is
 * absent (N8N_BASE_URL is optional and may be undefined locally) or when the
 * workflow id is absent. A project id alone is not enough.
 */
export function buildEngineDeeplink(
  baseUrl: string | undefined,
  projectId: string | null | undefined,
  workflowId: string | null | undefined,
): string | null {
  if (!baseUrl || !workflowId) return null;

  // Normalise: strip any trailing slashes from the base so we never emit `//`.
  const base = baseUrl.replace(/\/+$/, "");

  if (projectId) {
    return `${base}/projects/${projectId}/workflow/${workflowId}`;
  }
  return `${base}/workflow/${workflowId}`;
}
