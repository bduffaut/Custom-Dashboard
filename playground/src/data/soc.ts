import { reactive } from 'vue'

// Simulated security data generated in the browser on a timer
// Every widget reads the same store, so numbers agree across widgets

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type HostStatus = 'healthy' | 'at-risk' | 'compromised' | 'offline'

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

export interface SecurityEvent {
  id: number
  time: Date
  severity: Severity
  source: string
  target: string
  message: string
}

export interface TrafficPoint {
  time: Date
  allowed: number
  blocked: number
}

export interface Host {
  name: string
  ip: string
  status: HostStatus
}

export interface Vulnerability {
  cve: string
  title: string
  cvss: number
  assets: number
  status: 'open' | 'patching' | 'mitigated'
}

export type MetricKey = 'alerts' | 'blocked' | 'mttr' | 'endpoints'

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!
const between = (min: number, max: number) => min + Math.random() * (max - min)
const randomIp = () => `${pick([45, 91, 103, 185, 194, 203])}.${Math.floor(between(1, 255))}.${Math.floor(between(1, 255))}.${Math.floor(between(1, 255))}`

const MESSAGES: Record<Severity, string[]> = {
  critical: ['Ransomware signature detected', 'Credential dumping via LSASS', 'Outbound C2 beacon confirmed', 'Privilege escalation on domain controller'],
  high: ['Brute force on SSH', 'Suspicious PowerShell execution', 'Impossible travel login', 'Malicious macro blocked'],
  medium: ['Port scan detected', 'Unusual DNS volume', 'MFA push fatigue pattern', 'TLS certificate mismatch'],
  low: ['Failed login', 'Policy violation: USB device', 'Outdated agent version', 'Geo-blocked request'],
}

const TARGETS = ['web-prod-01', 'db-core-02', 'vpn-gw', 'dc-01', 'mail-relay', 'k8s-node-07', 'hr-laptop-114', 'api-gw']

const COUNTRIES = ['Russia', 'China', 'Brazil', 'North Korea', 'Iran', 'Vietnam', 'Netherlands', 'United States']

function makeEvent(id: number): SecurityEvent {
  // Mostly low noise, occasionally something serious
  const roll = Math.random()
  const severity: Severity = roll < 0.06 ? 'critical' : roll < 0.22 ? 'high' : roll < 0.55 ? 'medium' : 'low'
  return { id, time: new Date(), severity, source: randomIp(), target: pick(TARGETS), message: pick(MESSAGES[severity]) }
}

function makeHosts(): Host[] {
  const roles = ['web', 'db', 'app', 'k8s', 'vpn', 'mail', 'dc', 'lap', 'ws', 'cache']
  return Array.from({ length: 64 }, (_, i) => ({
    name: `${roles[i % roles.length]}-${String(i + 1).padStart(2, '0')}`,
    ip: `10.0.${Math.floor(i / 16)}.${(i % 16) + 10}`,
    status: (Math.random() < 0.82 ? 'healthy' : Math.random() < 0.6 ? 'at-risk' : Math.random() < 0.5 ? 'offline' : 'compromised') as HostStatus,
  }))
}

const VULNS: Vulnerability[] = [
  { cve: 'CVE-2026-21887', title: 'Remote code execution in VPN gateway', cvss: 9.8, assets: 4, status: 'open' },
  { cve: 'CVE-2026-1043', title: 'Auth bypass in admin panel', cvss: 9.1, assets: 2, status: 'patching' },
  { cve: 'CVE-2025-48219', title: 'Kernel privilege escalation', cvss: 7.8, assets: 31, status: 'patching' },
  { cve: 'CVE-2026-3301', title: 'Deserialization flaw in API framework', cvss: 8.6, assets: 9, status: 'open' },
  { cve: 'CVE-2025-39940', title: 'SMB information disclosure', cvss: 5.3, assets: 44, status: 'mitigated' },
  { cve: 'CVE-2026-0811', title: 'XSS in customer portal', cvss: 6.1, assets: 3, status: 'open' },
  { cve: 'CVE-2025-50122', title: 'Weak TLS cipher negotiation', cvss: 3.7, assets: 58, status: 'mitigated' },
  { cve: 'CVE-2026-7714', title: 'Container escape via runtime', cvss: 8.8, assets: 12, status: 'patching' },
]

export function severityOf(cvss: number): Severity {
  return cvss >= 9 ? 'critical' : cvss >= 7 ? 'high' : cvss >= 4 ? 'medium' : 'low'
}

const HISTORY = 60

export const soc = reactive({
  events: [] as SecurityEvent[],
  traffic: [] as TrafficPoint[],
  severityCounts: { critical: 12, high: 57, medium: 214, low: 690 } as Record<Severity, number>,
  origins: COUNTRIES.map((country) => ({ country, attempts: Math.round(between(200, 4000)) })),
  hosts: makeHosts(),
  vulns: VULNS,
  risk: 58,
  metrics: {
    alerts: { value: 973, history: [] as number[] },
    blocked: { value: 48210, history: [] as number[] },
    mttr: { value: 18, history: [] as number[] },
    endpoints: { value: 61, history: [] as number[] },
  } as Record<MetricKey, { value: number; history: number[] }>,
})

let nextId = 1
let started = false

function tick() {
  const now = new Date()

  // Requests per second with occasional attack bursts
  const burst = Math.random() < 0.08 ? between(300, 900) : 0
  const allowed = Math.round(between(900, 1300))
  const blocked = Math.round(between(40, 140) + burst)
  soc.traffic.push({ time: now, allowed, blocked })
  if (soc.traffic.length > HISTORY) soc.traffic.shift()

  // New events
  const count = Math.random() < 0.35 ? 0 : Math.random() < 0.7 ? 1 : 2
  for (let i = 0; i < count; i++) {
    const event = makeEvent(nextId++)
    soc.events.unshift(event)
    soc.severityCounts[event.severity]++
    soc.metrics.alerts.value++
  }
  if (soc.events.length > 200) soc.events.length = 200

  // Attack origins drift
  const origin = pick(soc.origins)
  origin.attempts += Math.round(between(5, 60) + burst / 10)

  // Hosts occasionally change status
  if (Math.random() < 0.15) {
    const host = pick(soc.hosts)
    host.status = host.status === 'healthy' ? pick(['at-risk', 'at-risk', 'offline', 'compromised'] as const) : 'healthy'
  }

  // Metrics
  soc.metrics.blocked.value += blocked
  soc.metrics.mttr.value = Math.max(4, Math.round(soc.metrics.mttr.value + between(-1.2, 1.2)))
  soc.metrics.endpoints.value = soc.hosts.filter((h) => h.status !== 'offline').length
  for (const metric of Object.values(soc.metrics)) {
    metric.history.push(metric.value)
    if (metric.history.length > 30) metric.history.shift()
  }

  // Risk follows recent severe activity
  const recentSevere = soc.events.slice(0, 20).filter((e) => e.severity === 'critical' || e.severity === 'high').length
  const target = 30 + recentSevere * 5 + soc.hosts.filter((h) => h.status === 'compromised').length * 6
  soc.risk = Math.round(Math.min(100, Math.max(0, soc.risk + (target - soc.risk) * 0.15 + between(-2, 2))))
}

/* Start the simulation once and prefill history so charts are not empty */
export function useSoc() {
  if (!started) {
    started = true
    for (let i = 0; i < HISTORY; i++) {
      const firstNew = nextId
      tick()
      const time = new Date(Date.now() - (HISTORY - i) * 1000)
      soc.traffic[soc.traffic.length - 1]!.time = time
      for (const event of soc.events) {
        if (event.id < firstNew) break
        event.time = time
      }
    }
    setInterval(tick, 1000)
  }
  return soc
}
