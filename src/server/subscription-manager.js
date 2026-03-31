// Topic -> Set<WebSocket>
const subscriptions = new Map();

let onFirstSubscribe = null;
let onLastUnsubscribe = null;

function subscribe(ws, topic) {
  if (!subscriptions.has(topic)) {
    subscriptions.set(topic, new Set());
  }

  const clients = subscriptions.get(topic);
  const wasEmpty = clients.size === 0;
  clients.add(ws);

  if (wasEmpty && onFirstSubscribe) {
    onFirstSubscribe(topic);
  }

  console.log(`[WS] subscribe: ${topic} (${clients.size} clients)`);
}

function unsubscribe(ws, topic) {
  const clients = subscriptions.get(topic);
  if (!clients) return;

  clients.delete(ws);
  console.log(`[WS] unsubscribe: ${topic} (${clients.size} clients)`);

  if (clients.size === 0) {
    subscriptions.delete(topic);
    if (onLastUnsubscribe) {
      onLastUnsubscribe(topic);
    }
  }
}

function unsubscribeAll(ws) {
  for (const [topic, clients] of subscriptions.entries()) {
    if (clients.has(ws)) {
      clients.delete(ws);
      if (clients.size === 0) {
        subscriptions.delete(topic);
        if (onLastUnsubscribe) {
          onLastUnsubscribe(topic);
        }
      }
    }
  }
}

function getSubscribers(topic) {
  return subscriptions.get(topic) || new Set();
}

function hasSubscribers(topic) {
  const clients = subscriptions.get(topic);
  return clients != null && clients.size > 0;
}

function broadcast(topic, data) {
  const clients = getSubscribers(topic);
  if (clients.size === 0) return;

  const message = JSON.stringify({ type: "data", topic, data });

  for (const ws of clients) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(message);
    }
  }
}

function broadcastError(topic, error) {
  const clients = getSubscribers(topic);
  if (clients.size === 0) return;

  const message = JSON.stringify({
    type: "data",
    topic,
    error: typeof error === "string" ? error : error.message || "Unknown error",
  });

  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}

function setCallbacks(first, last) {
  onFirstSubscribe = first;
  onLastUnsubscribe = last;
}

module.exports = {
  subscribe,
  unsubscribe,
  unsubscribeAll,
  getSubscribers,
  hasSubscribers,
  broadcast,
  broadcastError,
  setCallbacks,
  subscriptions,
};
