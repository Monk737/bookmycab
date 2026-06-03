export interface TrendPoint {
  /** Short axis label, e.g. "3 Jun". */
  label: string;
  /** Count in the current period for this bucket. */
  current: number;
  /** Count in the preceding period of equal length, aligned by offset. */
  previous: number;
}

export interface ResponseStats {
  /** Number of conversations that had a measurable first response. */
  sampleSize: number;
  avgSeconds: number;
  p50Seconds: number;
  p95Seconds: number;
}

export interface RevenueSummary {
  /** Sum of fares across all bookings in range (any status). */
  totalFare: number;
  avgFare: number;
  completedCount: number;
  bookingCount: number;
  /** completed / bookingCount, 0–100. */
  completionPct: number;
  /** Booking count by status, descending, for a chart. */
  byStatus: { name: string; value: number }[];
}
