import { defineWidgets, type GridWidget } from 'custom-dashboard-grid'

// The starting dashboard, tall on purpose so auto-scroll can be tried
export function defaultLayout(): GridWidget[] {
  // defineWidgets lets entries skip x and y, the grid places those
  return defineWidgets([
    { id: 'kpi-alerts', type: 'kpi', x: 0, y: 0, w: 3, h: 2, props: { metric: 'alerts' } },
    { id: 'kpi-blocked', type: 'kpi', x: 3, y: 0, w: 3, h: 2, props: { metric: 'blocked' } },
    { id: 'kpi-mttr', type: 'kpi', x: 6, y: 0, w: 3, h: 2, props: { metric: 'mttr' } },
    { id: 'kpi-endpoints', type: 'kpi', x: 9, y: 0, w: 3, h: 2, props: { metric: 'endpoints' } },
    { id: 'traffic', type: 'traffic', x: 0, y: 2, w: 8, h: 5 },
    // Locked, you can move it but other widgets never push it
    { id: 'risk', type: 'risk', x: 8, y: 2, w: 4, h: 3, locked: true },
    { id: 'severity', type: 'severity', x: 8, y: 5, w: 4, h: 3 },
    { id: 'events', type: 'events', x: 0, y: 8, w: 7, h: 6 },
    { id: 'origins', type: 'origins', x: 7, y: 8, w: 5, h: 6 },
    { id: 'vulns', type: 'vulns', x: 0, y: 14, w: 7, h: 6 },
    { id: 'hosts', type: 'hosts', x: 7, y: 14, w: 5, h: 6 },
    {
      id: 'incident-main',
      type: 'incident',
      x: 0,
      y: 20,
      w: 8,
      h: 9,
      props: {
        incidentId: 'INC-4821',
        widgets: [
          {
            id: 'inc-notes',
            type: 'notes',
            x: 0,
            y: 0,
            w: 7,
            h: 5,
            props: {
              title: 'Timeline',
              text: '09:12 Phishing mail opened (hr-laptop-114)\n09:15 Macro spawned PowerShell\n09:21 C2 beacon to 185.220.101.4\n09:24 Host isolated\n\nNext: reset creds, sweep for same hash',
            },
          },
          { id: 'inc-firewall', type: 'firewall', x: 7, y: 0, w: 5, h: 5, props: { ips: ['185.220.101.4', '45.155.205.0/24'] } },
          { id: 'inc-severity', type: 'severity', x: 0, y: 5, w: 12, h: 4 },
        ],
      },
    },
    { id: 'firewall', type: 'firewall', x: 8, y: 20, w: 4, h: 4, props: { ips: ['103.77.192.18'] } },
    { id: 'clock', type: 'clock', x: 8, y: 24, w: 4, h: 5, static: true },
    { id: 'crash', type: 'crash', x: 0, y: 29, w: 4, h: 3 },
    // No x or y so the grid places it, sizeToContent grows it with its steps
    {
      id: 'runbook',
      type: 'runbook',
      w: 4,
      h: 3,
      sizeToContent: true,
      props: {
        title: 'Phishing runbook',
        steps: [
          { text: 'Isolate affected host', done: true },
          { text: 'Pull mail headers and URLs', done: true },
          { text: 'Block sender domain', done: false },
          { text: 'Reset user credentials', done: false },
        ],
      },
    },
  ])
}
