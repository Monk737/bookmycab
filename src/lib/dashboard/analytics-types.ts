export interface Funnel { inbound: number; greeted: number; intent: number; quoted: number; confirmed: number; booked: number; }
export interface NamedValue { name: string; value: number; }
export interface ZoneRow { zone: string; count: number; pct: number; }
export interface HeatmapCell { day: number; hour: number; value: number; }
export interface AbandonmentRow { reason: string; count: number; }
export interface AnalyticsRange { from?: string; to?: string; }
