---
title: WebSocket Migration Plan
description: Migrate widget periodic polling updates to server-pushed WebSocket messages
---

# WebSocket Migration Plan

Migrate the client-side widget data updates from HTTP polling (SWR `refreshInterval`) to a server-pushed WebSocket model.

## Current Architecture

### Polling call families

The client uses **three distinct polling patterns**, all SWR-based but hitting different API routes:

#### Family 1 — Widget API proxy (`useWidgetAPI` hook)

1. Each widget component calls `useWidgetAPI()` which wraps SWR's `useSWR` hook
2. SWR fires HTTP `GET` requests on a per-widget `refreshInterval`
3. Every request hits `/api/services/proxy`, which resolves the widget type, maps the opaque endpoint name to a real endpoint, and calls the external service
4. The response is returned to SWR, which updates the React state

**~40+ widget endpoints** — Sonarr, Plex, Jellyfin, Radarr, HomeAssistant, Tautulli, Custom API, Prometheus, iCal, etc.

#### Family 2 — Direct SWR with `refreshInterval` (dedicated API routes)

These components call `useSWR` directly (not through `useWidgetAPI`) against dedicated Next.js API routes:

| Component | Endpoint | Interval | File |
|-----------|----------|----------|------|
| CPU | `/api/widgets/resources?type=cpu` | 1,500 ms | `src/components/widgets/resources/cpu.jsx` |
| Memory | `/api/widgets/resources?type=memory` | 1,500 ms | `src/components/widgets/resources/memory.jsx` |
| Disk | `/api/widgets/resources?type=disk&target=...` | 1,500 ms | `src/components/widgets/resources/disk.jsx` |
| Network | `/api/widgets/resources?type=network&interfaceName=...` | 1,500 ms | `src/components/widgets/resources/network.jsx` |
| CPU Temp | `/api/widgets/resources?type=cputemp` | 1,500 ms | `src/components/widgets/resources/cputemp.jsx` |
| Uptime | `/api/widgets/resources?type=uptime` | 1,500 ms | `src/components/widgets/resources/uptime.jsx` |
| Glances | `/api/widgets/glances?...` | 1,500 ms | `src/components/widgets/glances/glances.jsx` |
| Kubernetes | `/api/widgets/kubernetes?...` | 1,500 ms | `src/components/widgets/kubernetes/kubernetes.jsx` |
| Longhorn | `/api/widgets/longhorn` | 1,500 ms | `src/components/widgets/longhorn/longhorn.jsx` |
| Ping | `/api/ping?groupName=...&serviceName=...` | 30,000 ms | `src/components/services/ping.jsx` |
| Site Monitor | `/api/siteMonitor?groupName=...&serviceName=...` | 30,000 ms | `src/components/services/site-monitor.jsx` |

#### Family 3 — One-time SWR fetches (no polling, but candidates for push)

These fetch once on mount with no `refreshInterval`. They could benefit from server-pushed updates when the underlying data changes:

| Component | Endpoint | File |
|-----------|----------|------|
| Docker status | `/api/docker/status/{container}/{server}` | `src/components/services/status.jsx` |
| Docker stats | `/api/docker/stats/{container}/{server}` | `src/widgets/docker/component.jsx` |
| K8s status | `/api/kubernetes/status/{ns}/{app}` | `src/components/services/kubernetes-status.jsx` |
| K8s stats | `/api/kubernetes/stats/{ns}/{app}` | `src/widgets/kubernetes/component.jsx` |
| Proxmox stats | `/api/proxmox/stats/{node}/{vmid}` | `src/widgets/proxmoxvm/component.jsx`, `src/components/services/proxmox-status.jsx` |
| Weather | `/api/widgets/weather`, `/api/widgets/openmeteo`, `/api/widgets/openweathermap` | `src/components/widgets/weather/` and `openmeteo/`, `openweathermap/` |
| Stocks | `/api/widgets/stocks` | `src/components/widgets/stocks/stocks.jsx` |
| Config hash | `/api/hash` | `src/pages/index.jsx` |

**Notable gap**: Docker, K8s, and Proxmox container/VM widgets never refresh after initial load. These are strong candidates for WebSocket push — the server can detect container state changes and push immediately rather than relying on the user to reload.

### Key files

| File | Role |
|------|------|
| `src/utils/proxy/use-widget-api.js` | Client hook — wraps SWR, sets `refreshInterval` |
| `src/pages/api/services/proxy.js` | Server proxy — dispatches to per-widget proxy handlers |
| `src/pages/api/widgets/resources.js` | System resource metrics endpoint (CPU, memory, disk, network, temp, uptime) |
| `src/pages/api/widgets/glances.js` | Glances metrics endpoint |
| `src/pages/api/widgets/kubernetes.js` | Kubernetes cluster metrics endpoint |
| `src/pages/api/widgets/longhorn.js` | Longhorn storage endpoint |
| `src/pages/api/ping.js` | Ping service status endpoint |
| `src/pages/api/siteMonitor.js` | Site monitor endpoint |
| `src/pages/api/docker/status/` | Docker container status endpoint |
| `src/pages/api/docker/stats/` | Docker container stats endpoint |
| `src/widgets/*/widget.js` | Widget definitions — declare `api`, `mappings`, `proxyHandler` |
| `src/utils/config/service-helpers.js` | Parses widget config from YAML, attaches `refreshInterval` |
| `src/pages/_app.jsx` | Global SWR config — sets the default fetcher |
| `src/widgets/components.js` | Dynamic widget component loader |

### Polling intervals summary

| Widget category | Current interval | Polling family |
|----------------|-----------------|----------------|
| System metrics (Glances, K8s, Longhorn) | 1,500 ms | Family 2 (direct SWR) |
| Resources (CPU, memory, disk, network, temp, uptime) | 1,500 ms | Family 2 (direct SWR) |
| Now Playing (Plex, Jellyfin, Emby) | 5,000 ms | Family 1 (useWidgetAPI) |
| Custom API, Prometheus | 10,000 ms | Family 1 (useWidgetAPI) |
| Services (Ping, Site Monitor) | 30,000 ms | Family 2 (direct SWR) |
| JDownloader | 30,000 ms | Family 1 (useWidgetAPI) |
| HomeAssistant | 60,000 ms | Family 1 (useWidgetAPI) |
| Calendar / iCal | 300,000 ms | Family 1 (useWidgetAPI) |
| Docker / K8s / Proxmox status | Never (mount only) | Family 3 (one-time) |
| Weather / Stocks | Never (mount only) | Family 3 (one-time) |

### Existing WebSocket usage

The `ws` package (v8.18.3) is already a dependency, used server-side only in `src/widgets/truenas/proxy.js` for JSON-RPC over WebSocket to TrueNAS. There is no client-facing WebSocket infrastructure today.

---

## Proposed Architecture

### Design overview

```
┌─────────────┐        ws://        ┌───────────────────────┐
│   Browser    │◄──────────────────►│  WebSocket Gateway     │
│              │   per-client conn  │  (Next.js custom       │
│  useWidgetWS │                    │   server or standalone) │
│  hook        │                    └──────┬────────────────┘
└─────────────┘                           │
                                          │ manages
                                    ┌─────▼─────────────┐
                                    │  Subscription      │
                                    │  Manager           │
                                    │  (topic → clients) │
                                    └─────┬─────────────┘
                                          │ polls on
                                          │ server-side
                                    ┌─────▼─────────────┐
                                    │  Widget Pollers    │
                                    │  (per-topic timers │
                                    │   → proxy handlers)│
                                    └───────────────────┘
```

**Key idea**: Move the polling loop from N browser tabs to a single server-side loop. The server fetches external service data on a schedule, diffs or broadcasts, and pushes updates to all connected clients over a single WebSocket connection per client.

### Components

#### 1. WebSocket Gateway (`src/server/ws-gateway.js`)

- Attach a `ws.Server` to the existing HTTP server via a Next.js custom server (`server.js`) or standalone process
- Authenticate connections using the same session/API key mechanism used by the HTTP proxy
- Accept `subscribe` / `unsubscribe` messages from clients:
  ```json
  { "type": "subscribe", "topics": ["widget:sonarr:0:queue", "widget:plex:0:sessions"] }
  ```
- Route incoming data from the Subscription Manager to the appropriate connected clients

#### 2. Subscription Manager (`src/server/subscription-manager.js`)

- Maintain a `Map<topic, Set<WebSocket>>` of active subscriptions
- When the first client subscribes to a topic, start a server-side poller for that topic
- When the last client unsubscribes (or disconnects), stop the poller
- Reference-count topics to avoid redundant fetches

#### 3. Server-Side Pollers (`src/server/widget-poller.js`)

- Reuse the existing proxy handler infrastructure (`genericProxyHandler`, `credentialedProxyHandler`, widget `mappings`) to fetch data
- Run each topic's fetch on the interval defined in the widget config (same intervals as today, or tunable)
- On each fetch, compare result with the last-known value; broadcast only on change (optional — simple broadcast-always is fine for v1)
- Emit data to the Subscription Manager, which fans out to clients

#### 4. Client Hook (`src/utils/proxy/use-widget-ws.js`)

New React hook that replaces `useWidgetAPI` for WebSocket-backed widgets:

```javascript
import { useEffect, useState } from "react";
import { useWebSocket } from "./ws-context";

export default function useWidgetWS(widget, endpoint, options) {
  const { subscribe, unsubscribe } = useWebSocket();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const topic = buildTopic(widget, endpoint);

  useEffect(() => {
    const handler = (message) => {
      if (message.error) setError(message.error);
      else setData(message.data);
    };

    subscribe(topic, handler);
    return () => unsubscribe(topic, handler);
  }, [topic]);

  return { data, error };
}
```

#### 5. WebSocket Context Provider (`src/utils/proxy/ws-context.js`)

- Singleton WebSocket connection per browser tab
- Auto-reconnect with exponential backoff
- Provide `subscribe(topic, callback)` / `unsubscribe(topic, callback)` via React context
- Aggregate subscriptions and send batch `subscribe`/`unsubscribe` messages to server
- Expose connection status for UI indicators

---

## Migration Strategy

### Phase 1 — Infrastructure (no user-facing changes)

1. **Create custom server entry point** (`server.js`)
   - Wrap the existing Next.js app
   - Attach `ws.Server` on `upgrade` events
   - Preserve all existing HTTP routing

2. **Implement WebSocket Gateway + Subscription Manager**
   - Basic subscribe/unsubscribe protocol
   - Connection lifecycle (heartbeat/ping-pong, cleanup on disconnect)

3. **Implement client-side WebSocket context provider**
   - Add `<WebSocketProvider>` inside `_app.jsx`
   - Auto-reconnect, heartbeat, connection status

### Phase 2 — Parallel mode (opt-in per widget)

4. **Implement `useWidgetWS` hook**
   - Mirror the `useWidgetAPI` return shape (`{ data, error, mutate }`) for drop-in compatibility
   - `mutate` can trigger an immediate server-side re-fetch via a WebSocket `refresh` message

5. **Implement server-side pollers**
   - Reuse existing proxy handler functions — call them from the poller instead of from an HTTP request handler
   - Refactor proxy handlers to accept a plain options object (not `req`/`res`) so they can be called from both HTTP and poller contexts

6. **Migrate a pilot widget from Family 2** (e.g., `resources/cpu.jsx`)
   - Wire it up end-to-end: subscribe on mount → receive pushes → render
   - Keep SWR polling as fallback: if WebSocket is disconnected, fall back to direct `useSWR` with `refreshInterval`
   - Validate correctness, latency, and resource usage

### Phase 3 — Broad rollout across all three families

7. **Migrate Family 2 — direct SWR pollers** (highest frequency, biggest win)
   - Resources (cpu, memory, disk, network, cputemp, uptime) — all at 1,500 ms
   - Glances, Kubernetes dashboard, Longhorn — all at 1,500 ms
   - Ping, Site Monitor — at 30,000 ms
   - These bypass `useWidgetAPI` so each needs its own `useSWR` → `useWidgetWS` swap

8. **Migrate Family 1 — `useWidgetAPI` widgets**
   - Replace `useWidgetAPI` internals or provide a WebSocket-aware wrapper
   - High-frequency first: now-playing widgets (Plex, Jellyfin, Emby, Tautulli — 5,000 ms)
   - Then medium: Custom API, Prometheus (10,000 ms), JDownloader (30,000 ms)
   - Then low: HomeAssistant (60,000 ms), Calendar/iCal (300,000 ms)

9. **Migrate Family 3 — one-time fetches to event-driven push**
   - Docker status/stats, K8s status/stats, Proxmox stats — these currently never refresh; WebSocket push means they update immediately on container/pod state changes
   - Weather, Stocks — push on a server-side schedule (e.g., every 15 min) instead of never refreshing
   - Config hash (`/api/hash`) — push when server detects config file change, replacing the window-focus-based revalidation

10. **Add `refreshInterval` parity in server-side pollers**
    - Honor user-configured `refreshInterval` from YAML config
    - Support per-widget minimum intervals (same as current: 1,000 ms floor for custom API / iframe)

11. **Add change-detection / diffing** (optional optimization)
    - Only push to clients when the data actually changed
    - Reduces React re-renders and browser CPU usage
    - Especially valuable for Family 3 topics where the server polls but data rarely changes

### Phase 4 — Cleanup and polish

12. **Remove SWR polling from migrated widgets**
    - Delete `refreshInterval` config from migrated widget components
    - Keep SWR for initial data fetch (SSR/ISR) if desired, or use WebSocket for initial load too

13. **Update configuration docs**
    - Document the WebSocket transport
    - Document any new config options (e.g., `transport: websocket | polling`)
    - Document fallback behavior

14. **Deprecate polling path**
    - Optionally allow users to force polling mode via config for environments where WebSocket is not viable (reverse proxies, firewalls)

---

## Topic Naming Convention

```
{family}:{type}:{identifier}:{endpoint}
```

### Family 1 — proxied widgets
```
proxy:{type}:{group}:{service}:{endpoint}
```
- `proxy:sonarr:media:sonarr:queue`
- `proxy:plex:media:plex:sessions`
- `proxy:homeassistant:home:hass:null`

### Family 2 — direct resource/service endpoints
```
resource:{type}:{target?}
service:{type}:{group}:{name}
```
- `resource:cpu` / `resource:memory` / `resource:disk:/mnt/data` / `resource:network:eth0`
- `resource:cputemp` / `resource:uptime`
- `resource:glances:{instanceName}`
- `resource:kubernetes` / `resource:longhorn`
- `service:ping:media:sonarr`
- `service:siteMonitor:infra:grafana`

### Family 3 — event-driven status
```
status:docker:{container}:{server}
status:kubernetes:{namespace}:{app}
status:proxmox:{node}:{vmid}
config:hash
weather:{provider}:{location}
```
- `status:docker:plex:local`
- `status:kubernetes:default:nginx`
- `status:proxmox:node1:100`
- `config:hash`
- `weather:openmeteo:52.52,13.41`

---

## Fallback Strategy

WebSocket connections can fail (corporate proxies, certain reverse proxy configs). The system must gracefully degrade:

1. **Connection failure on init** — fall back to SWR polling (current behavior)
2. **Connection drops mid-session** — reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s); use SWR polling during reconnection window
3. **User opt-out** — config flag `useWebSocket: false` to force polling for all widgets

The `useWidgetWS` hook should internally manage this fallback so widget components don't need to be aware of the transport.

---

## Considerations

### Server resource impact

- **Fewer outbound requests**: Today, 3 browser tabs × 50 widgets × per-widget interval = hundreds of redundant external API calls. With server-side polling, each external endpoint is fetched once regardless of client count.
- **Memory**: The subscription manager holds last-known data per topic. For ~200 widget topics this is negligible.
- **CPU**: WebSocket frame encoding is cheaper than HTTP request/response serialization.

### Security

- WebSocket connections must validate the same auth as HTTP API routes
- Topic subscriptions must be validated against the user's configured services (prevent subscribing to arbitrary topics)
- Use `wss://` in production (handled by reverse proxy TLS termination)

### Docker / deployment

- The custom server must be the new Docker entrypoint instead of `next start`
- Ensure `EXPOSE` includes the WebSocket port (same port as HTTP if using upgrade, which is recommended)
- Health checks should verify both HTTP and WebSocket readiness

### Compatibility with multi-tab usage

- Each browser tab opens its own WebSocket connection
- The server deduplicates external fetches via the Subscription Manager (topic-level, not connection-level)
- Optional future optimization: use `BroadcastChannel` API to share a single WebSocket across tabs

---

## Estimated Complexity by Phase

| Phase | Scope | Risk |
|-------|-------|------|
| Phase 1 — Infrastructure | Custom server + WS gateway + client provider | Medium — changes server startup |
| Phase 2 — Parallel mode | New hook + server pollers + pilot widget | Low — additive, no breakage |
| Phase 3 — Broad rollout | Per-widget migration | Low — mechanical, one widget at a time |
| Phase 4 — Cleanup | Remove polling, update docs | Low |

---

## Open Questions

1. **Standalone WS server vs. same-process?** Running the WebSocket server in the same Node.js process as Next.js is simpler but couples scaling. A separate process allows independent scaling but adds deployment complexity.

2. **Binary protocol?** JSON is fine for v1. If bandwidth becomes an issue (many clients, high-frequency metrics), consider MessagePack or protocol buffers.

3. **Server-Sent Events (SSE) as alternative?** SSE is simpler (HTTP-based, no upgrade needed, works through more proxies) but is unidirectional — clients can't send subscribe/unsubscribe messages over the same channel. For this use case, WebSocket's bidirectionality is valuable.

4. **SWR integration?** SWR supports custom `fetcher` and `subscribe` options. It may be possible to keep SWR as the state manager but swap the transport to WebSocket under the hood via SWR's `useSWRSubscription`. This would minimize client-side code changes.
