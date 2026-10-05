import type { Component } from 'vue'
import {
  Activity,
  Bomb,
  Ban,
  Bug,
  Clock,
  Gauge,
  Globe,
  Layers,
  ListChecks,
  MonitorCheck,
  NotebookPen,
  Server,
  ShieldAlert,
  ShieldBan,
  Siren,
  Timer,
} from 'lucide-vue-next'
import type { CatalogEntry, NewGridWidget, SizeLimits } from 'custom-dashboard-grid'
import AttackOriginsWidget from './AttackOriginsWidget.vue'
import ClockWidget from './ClockWidget.vue'
import CrashTestWidget from './CrashTestWidget.vue'
import EventFeedWidget from './EventFeedWidget.vue'
import FirewallWidget from './FirewallWidget.vue'
import HostHeatmapWidget from './HostHeatmapWidget.vue'
import IncidentGroupWidget from './IncidentGroupWidget.vue'
import KpiWidget from './KpiWidget.vue'
import NotesWidget from './NotesWidget.vue'
import RiskGaugeWidget from './RiskGaugeWidget.vue'
import RunbookWidget from './RunbookWidget.vue'
import SeverityWidget from './SeverityWidget.vue'
import TrafficChartWidget from './TrafficChartWidget.vue'
import VulnerabilityTableWidget from './VulnerabilityTableWidget.vue'

// Everything the app knows about its widget types
// The grid only needs widgetComponents, the add menus feed catalog to useWidgetCatalog

/* Widget type to component, passed to the components prop */
export const widgetComponents: Record<string, Component> = {
  kpi: KpiWidget,
  events: EventFeedWidget,
  traffic: TrafficChartWidget,
  severity: SeverityWidget,
  origins: AttackOriginsWidget,
  vulns: VulnerabilityTableWidget,
  hosts: HostHeatmapWidget,
  risk: RiskGaugeWidget,
  firewall: FirewallWidget,
  notes: NotesWidget,
  clock: ClockWidget,
  incident: IncidentGroupWidget,
  crash: CrashTestWidget,
  runbook: RunbookWidget,
}

/*
 * Smallest size each widget type supports, in cells of the main grid (52px rows)
 * Each one is the size where that widget's most compact view still fits without clipping
 */
export const SIZE_LIMITS: Record<string, SizeLimits> = {
  kpi: { minW: 2, minH: 2 },
  traffic: { minW: 4, minH: 3 },
  severity: { minW: 3, minH: 2 },
  risk: { minW: 2, minH: 3 },
  origins: { minW: 3, minH: 3 },
  events: { minW: 3, minH: 3 },
  vulns: { minW: 4, minH: 3 },
  hosts: { minW: 3, minH: 3 },
  firewall: { minW: 3, minH: 3 },
  notes: { minW: 2, minH: 2 },
  clock: { minW: 3, minH: 2 },
  incident: { minW: 4, minH: 5 },
  crash: { minW: 3, minH: 3 },
  runbook: { minW: 3 },
}

/* The same limits for a grid with different row and gap sizes, so content keeps the same room in pixels */
export function limitsForRows(rowHeight: number, gap: number): Record<string, SizeLimits> {
  const step = (rows: number) => rows * 52 + (rows - 1) * 12
  return Object.fromEntries(
    Object.entries(SIZE_LIMITS).map(([type, l]) => [
      type,
      { ...l, minH: l.minH ? Math.ceil((step(l.minH) + gap) / (rowHeight + gap)) : undefined },
    ]),
  )
}

export type Category = 'Monitoring' | 'Threat intel' | 'Assets' | 'Response' | 'Testing'
export const CATEGORIES: Category[] = ['Monitoring', 'Threat intel', 'Assets', 'Response', 'Testing']

/* A library catalog entry plus an icon, with a plain widget so menus can show its size */
export interface PaletteEntry extends CatalogEntry {
  description: string
  category: Category
  icon: Component
  widget: NewGridWidget
}

export const catalog: PaletteEntry[] = [
  { key: 'kpi-alerts', name: 'Alert count', description: 'Alerts in the last 24 hours with trend', category: 'Monitoring', icon: ShieldAlert, widget: { type: 'kpi', w: 3, h: 2, props: { metric: 'alerts' } } },
  { key: 'kpi-blocked', name: 'Blocked requests', description: 'Requests stopped at the edge', category: 'Monitoring', icon: Ban, widget: { type: 'kpi', w: 3, h: 2, props: { metric: 'blocked' } } },
  { key: 'kpi-mttr', name: 'Mean time to respond', description: 'Average minutes from alert to triage', category: 'Response', icon: Timer, widget: { type: 'kpi', w: 3, h: 2, props: { metric: 'mttr' } } },
  { key: 'kpi-endpoints', name: 'Endpoints online', description: 'Agents currently reporting in', category: 'Assets', icon: MonitorCheck, widget: { type: 'kpi', w: 3, h: 2, props: { metric: 'endpoints' } } },
  { key: 'traffic', name: 'Network traffic', description: 'Allowed vs blocked requests per second', category: 'Monitoring', icon: Activity, widget: { type: 'traffic', w: 8, h: 5 } },
  { key: 'events', name: 'Security event feed', description: 'Live SIEM stream with severity filters', category: 'Monitoring', icon: Siren, widget: { type: 'events', w: 7, h: 6 } },
  { key: 'severity', name: 'Alerts by severity', description: 'Critical, high, medium and low counts', category: 'Monitoring', icon: ShieldAlert, widget: { type: 'severity', w: 4, h: 3 } },
  { key: 'risk', name: 'Risk score', description: 'Overall posture gauge from 0 to 100', category: 'Threat intel', icon: Gauge, widget: { type: 'risk', w: 4, h: 3 } },
  { key: 'origins', name: 'Attack origins', description: 'Top source countries by attempts', category: 'Threat intel', icon: Globe, widget: { type: 'origins', w: 5, h: 6 } },
  { key: 'vulns', name: 'Vulnerabilities', description: 'Sortable CVE table with CVSS scores', category: 'Threat intel', icon: Bug, widget: { type: 'vulns', w: 7, h: 6 } },
  { key: 'hosts', name: 'Asset health map', description: 'Every host as a status square', category: 'Assets', icon: Server, widget: { type: 'hosts', w: 5, h: 6 } },
  { key: 'firewall', name: 'Firewall blocklist', description: 'Block and unblock IPs, saved in the layout', category: 'Response', icon: ShieldBan, widget: { type: 'firewall', w: 4, h: 4, props: { ips: [] } } },
  {
    key: 'runbook',
    name: 'Runbook checklist',
    description: 'Steps to follow, grows to fit as you add them',
    category: 'Response',
    icon: ListChecks,
    widget: { type: 'runbook', w: 4, h: 3, sizeToContent: true, props: { steps: [{ text: 'Isolate affected host', done: false }] } },
  },
  { key: 'notes', name: 'Analyst notes', description: 'Free text, saved in the layout', category: 'Response', icon: NotebookPen, widget: { type: 'notes', w: 4, h: 4, props: { text: '' } } },
  { key: 'clock', name: 'Shift clock', description: 'UTC, local time and shift progress', category: 'Response', icon: Clock, widget: { type: 'clock', w: 4, h: 3 } },
  {
    key: 'incident',
    name: 'Incident workspace',
    description: 'A group with its own grid of widgets inside',
    category: 'Response',
    icon: Layers,
    widget: { type: 'incident', w: 8, h: 8, props: { widgets: [] } },
  },
  {
    key: 'crash',
    name: 'Unstable parser',
    description: 'Crashes on demand to show the error boundary',
    category: 'Testing',
    icon: Bomb,
    widget: { type: 'crash', w: 4, h: 3 },
  },
]
