const subscriptionManager = require("./subscription-manager");

// Resolved at gateway attach time
let serverPort = 3000;

function setPort(port) {
  serverPort = port;
}

// Default polling intervals by topic prefix
const DEFAULT_INTERVALS = {
  resource: 1500,
  glances: 1500,
  kubernetes: 1500,
  longhorn: 1500,
  "service:ping": 30000,
  "service:siteMonitor": 30000,
  proxy: 10000,
  "status:docker": 30000,
  "status:docker-stats": 30000,
  "status:kubernetes": 30000,
  "status:proxmox": 30000,
  "config:hash": 60000,
  weather: 900000,
  stocks: 900000,
};

// topic -> { timer, lastData, interval }
const activePollers = new Map();

function getIntervalForTopic(topic) {
  if (DEFAULT_INTERVALS[topic]) return DEFAULT_INTERVALS[topic];
  for (const [prefix, interval] of Object.entries(DEFAULT_INTERVALS)) {
    if (topic.startsWith(`${prefix}:`)) return interval;
  }
  return 10000;
}

/**
 * Convert a topic string to the local API URL that serves its data.
 *
 *  Family 1 (proxy widgets):
 *    proxy:{group}:{service}:{index}:{endpoint}
 *    -> /api/services/proxy?group=...&service=...&index=...&endpoint=...
 *
 *  Family 2 (resources):
 *    resource:{type}              -> /api/widgets/resources?type=...
 *    resource:{type}:{target}     -> /api/widgets/resources?type=...&target=... (or interfaceName)
 *    glances:{qs}                 -> /api/widgets/glances?{qs}
 *    kubernetes:{qs}              -> /api/widgets/kubernetes?{qs}
 *    longhorn                     -> /api/widgets/longhorn
 *    service:ping:{group}:{name}  -> /api/ping?groupName=...&serviceName=...
 *    service:siteMonitor:{g}:{n}  -> /api/siteMonitor?groupName=...&serviceName=...
 *
 *  Family 3 (status/event):
 *    status:docker:{container}:{server}  -> /api/docker/status/{container}/{server}
 *    status:docker-stats:{c}:{s}         -> /api/docker/stats/{c}/{s}
 *    status:kubernetes:{ns}:{app}        -> /api/kubernetes/status/{ns}/{app}
 *    status:proxmox:{node}:{vmid}        -> /api/proxmox/stats/{node}/{vmid}
 *    config:hash                         -> /api/hash
 *    weather:{provider}:{qs}             -> /api/widgets/{provider}?{qs}
 *    stocks:{qs}                         -> /api/widgets/stocks?{qs}
 */
function topicToURL(topic) {
  const parts = topic.split(":");

  // --- Family 1 ---
  if (parts[0] === "proxy") {
    const [, group, service, index, ...endpointParts] = parts;
    const endpoint = endpointParts.join(":");
    const qs = new URLSearchParams({ group, service, index, endpoint });
    return `/api/services/proxy?${qs}`;
  }

  // --- Family 2 ---
  if (parts[0] === "resource") {
    const type = parts[1];
    const qs = new URLSearchParams({ type });
    if (parts[2]) {
      if (type === "disk") qs.set("target", parts[2]);
      else if (type === "network") qs.set("interfaceName", parts[2]);
    }
    return `/api/widgets/resources?${qs}`;
  }

  if (parts[0] === "glances") {
    return `/api/widgets/glances?${parts.slice(1).join(":")}`;
  }

  if (parts[0] === "kubernetes" && parts.length > 1) {
    return `/api/widgets/kubernetes?${parts.slice(1).join(":")}`;
  }

  if (parts[0] === "longhorn") {
    return `/api/widgets/longhorn`;
  }

  if (parts[0] === "service") {
    if (parts[1] === "ping") {
      return `/api/ping?${new URLSearchParams({ groupName: parts[2], serviceName: parts[3] })}`;
    }
    if (parts[1] === "siteMonitor") {
      return `/api/siteMonitor?${new URLSearchParams({ groupName: parts[2], serviceName: parts[3] })}`;
    }
  }

  // --- Family 3 ---
  if (parts[0] === "status") {
    if (parts[1] === "docker") return `/api/docker/status/${parts[2]}/${parts[3] || ""}`;
    if (parts[1] === "docker-stats") return `/api/docker/stats/${parts[2]}/${parts[3] || ""}`;
    if (parts[1] === "kubernetes") return `/api/kubernetes/status/${parts[2]}/${parts[3]}`;
    if (parts[1] === "proxmox") return `/api/proxmox/stats/${parts[2]}/${parts[3]}`;
  }

  if (parts[0] === "config" && parts[1] === "hash") {
    return `/api/hash`;
  }

  if (parts[0] === "weather") {
    return `/api/widgets/${parts[1]}?${parts.slice(2).join(":")}`;
  }

  if (parts[0] === "stocks") {
    return `/api/widgets/stocks${parts[1] ? `?${parts[1]}` : ""}`;
  }

  return null;
}

async function fetchTopicData(topic) {
  const url = topicToURL(topic);
  if (!url) {
    return { status: 404, data: { error: `No handler for topic: ${topic}` } };
  }

  try {
    const res = await fetch(`http://localhost:${serverPort}${url}`);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { status: 500, data: { error: err.message } };
  }
}

async function poll(topic) {
  if (!subscriptionManager.hasSubscribers(topic)) {
    stopPoller(topic);
    return;
  }

  try {
    const result = await fetchTopicData(topic);
    if (result.status >= 200 && result.status < 300 && result.data) {
      subscriptionManager.broadcast(topic, result.data);
      const state = activePollers.get(topic);
      if (state) state.lastData = result.data;
    } else if (result.data?.error) {
      subscriptionManager.broadcastError(topic, result.data.error);
    }
  } catch (err) {
    console.error(`[WS] poller error for ${topic}: ${err.message}`);
    subscriptionManager.broadcastError(topic, err.message);
  }
}

function startPoller(topic) {
  if (activePollers.has(topic)) return;

  const interval = getIntervalForTopic(topic);
  console.log(`[WS] start poller: ${topic} (${interval}ms)`);

  // Fetch immediately
  poll(topic);

  const timer = setInterval(() => poll(topic), interval);
  activePollers.set(topic, { timer, lastData: null, interval });
}

function stopPoller(topic) {
  const state = activePollers.get(topic);
  if (!state) return;

  console.log(`[WS] stop poller: ${topic}`);
  clearInterval(state.timer);
  activePollers.delete(topic);
}

function refreshTopic(topic) {
  poll(topic);
}

function getLastData(topic) {
  return activePollers.get(topic)?.lastData || null;
}

// Wire up subscription manager callbacks
subscriptionManager.setCallbacks(
  (topic) => startPoller(topic),
  (topic) => stopPoller(topic),
);

module.exports = {
  setPort,
  startPoller,
  stopPoller,
  refreshTopic,
  getLastData,
  topicToURL,
  activePollers,
};
