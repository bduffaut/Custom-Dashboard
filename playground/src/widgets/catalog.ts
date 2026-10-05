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
import type { NewGridWidget } from 'custom-dashboard-grid'
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
// The grid only needs widgetComponents, the add menus use the rest

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

export type Category = 'Monitoring' | 'Threat intel' | 'Assets' | 'Response' | 'Testing'
export const CATEGORIES: Category[] = ['Monitoring', 'Threat intel', 'Assets', 'Response', 'Testing']

/* One add menu entry, several can share a type with different props */
export interface CatalogEntry {
  key: string
  type: string
  name: string
  description: string
  category: Category
  icon: Component
  w: number
  h: number
  minW?: number
  minH?: number
  /* Height follows the content */
  sizeToContent?: boolean | number
  props?: () => Record<string, unknown>
}

export const catalog: CatalogEntry[] = [
  { key: 'kpi-alerts', type: 'kpi', name: 'Alert count', description: 'Alerts in the last 24 hours with trend', category: 'Monitoring', icon: ShieldAlert, w: 3, h: 2, minW: 2, props: () => ({ metric: 'alerts' }) },
  { key: 'kpi-blocked', type: 'kpi', name: 'Blocked requests', description: 'Requests stopped at the edge', category: 'Monitoring', icon: Ban, w: 3, h: 2, minW: 2, props: () => ({ metric: 'blocked' }) },
  { key: 'kpi-mttr', type: 'kpi', name: 'Mean time to respond', description: 'Average minutes from alert to triage', category: 'Response', icon: Timer, w: 3, h: 2, minW: 2, props: () => ({ metric: 'mttr' }) },
  { key: 'kpi-endpoints', type: 'kpi', name: 'Endpoints online', description: 'Agents currently reporting in', category: 'Assets', icon: MonitorCheck, w: 3, h: 2, minW: 2, props: () => ({ metric: 'endpoints' }) },
  { key: 'traffic', type: 'traffic', name: 'Network traffic', description: 'Allowed vs blocked requests per second', category: 'Monitoring', icon: Activity, w: 8, h: 5, minW: 4, minH: 3 },
  { key: 'events', type: 'events', name: 'Security event feed', description: 'Live SIEM stream with severity filters', category: 'Monitoring', icon: Siren, w: 7, h: 6, minW: 4, minH: 3 },
  { key: 'severity', type: 'severity', name: 'Alerts by severity', description: 'Critical, high, medium and low counts', category: 'Monitoring', icon: ShieldAlert, w: 4, h: 3, minW: 3, minH: 2 },
  { key: 'risk', type: 'risk', name: 'Risk score', description: 'Overall posture gauge from 0 to 100', category: 'Threat intel', icon: Gauge, w: 4, h: 3, minW: 2, minH: 3 },
  { key: 'origins', type: 'origins', name: 'Attack origins', description: 'Top source countries by attempts', category: 'Threat intel', icon: Globe, w: 5, h: 6, minW: 3, minH: 3 },
  { key: 'vulns', type: 'vulns', name: 'Vulnerabilities', description: 'Sortable CVE table with CVSS scores', category: 'Threat intel', icon: Bug, w: 7, h: 6, minW: 4, minH: 3 },
  { key: 'hosts', type: 'hosts', name: 'Asset health map', description: 'Every host as a status square', category: 'Assets', icon: Server, w: 5, h: 6, minW: 3, minH: 3 },
  { key: 'firewall', type: 'firewall', name: 'Firewall blocklist', description: 'Block and unblock IPs, saved in the layout', category: 'Response', icon: ShieldBan, w: 4, h: 4, minW: 3, minH: 3, props: () => ({ ips: [] }) },
  {
    key: 'runbook',
    type: 'runbook',
    name: 'Runbook checklist',
    description: 'Steps to follow; grows to fit as you add them',
    category: 'Response',
    icon: ListChecks,
    w: 4,
    h: 3,
    minW: 3,
    sizeToContent: true,
    props: () => ({ steps: [{ text: 'Isolate affected host', done: false }] }),
  },
  { key: 'notes', type: 'notes', name: 'Analyst notes', description: 'Free text, saved in the layout', category: 'Response', icon: NotebookPen, w: 4, h: 4, minW: 2, minH: 2, props: () => ({ text: '' }) },
  { key: 'clock', type: 'clock', name: 'Shift clock', description: 'UTC, local time and shift progress', category: 'Response', icon: Clock, w: 4, h: 3, minW: 3, minH: 2 },
  {
    key: 'incident',
    type: 'incident',
    name: 'Incident workspace',
    description: 'A group with its own grid of widgets inside',
    category: 'Response',
    icon: Layers,
    w: 8,
    h: 8,
    minW: 4,
    minH: 5,
    props: () => ({ incidentId: `INC-${Math.floor(1000 + Math.random() * 9000)}`, widgets: [] }),
  },
  {
    key: 'crash',
    type: 'crash',
    name: 'Unstable parser',
    description: 'Crashes on demand to show the error boundary',
    category: 'Testing',
    icon: Bomb,
    w: 4,
    h: 3,
    minW: 3,
    minH: 2,
  },
]

/*
 * A new widget from a catalog entry, without id, x or y so the grid fills them in
 * Called fresh for every add or drop so props are never shared
 */
export function widgetTemplate(entry: CatalogEntry): NewGridWidget {
  return {
    type: entry.type,
    w: entry.w,
    h: entry.h,
    minW: entry.minW,
    minH: entry.minH,
    sizeToContent: entry.sizeToContent,
    props: entry.props?.() ?? {},
  }
}
