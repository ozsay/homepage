import classNames from "classnames";
import { useMemo, useState } from "react";
import { FiDownload, FiTrash2 } from "react-icons/fi";

import useWidgetWS from "utils/proxy/use-widget-ws";

import DockerGroup from "../docker-group";

function formatBytes(bytes) {
  if (bytes == null) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-theme-700 dark:text-theme-200 mb-1">{title}</h4>
      <div className="text-theme-500 dark:text-theme-300 font-light">{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="font-medium text-theme-600 dark:text-theme-300 min-w-[80px] shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ImageContent({ image, server, onRemoved }) {
  const [pulling, setPulling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState(null);

  if (!image) {
    return (
      <div className="flex-1 flex items-center justify-center text-theme-500 dark:text-theme-400 text-sm">
        Select an image
      </div>
    );
  }

  const tag = image.repoTags?.[0] || "<none>:<none>";
  const shortId = image.id?.replace("sha256:", "").slice(0, 12);

  async function handlePull() {
    setPulling(true);
    setError(null);
    try {
      const r = await fetch(`/api/docker/images/pull?server=${encodeURIComponent(server)}&image=${encodeURIComponent(tag)}`, { method: "POST" });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error?.message || "Pull failed");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPulling(false);
    }
  }

  async function handleRemove() {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setRemoving(true);
    setError(null);
    try {
      const r = await fetch(`/api/docker/images/${encodeURIComponent(image.id)}?server=${encodeURIComponent(server)}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) {
        const data = await r.json();
        throw new Error(data.error?.message || "Remove failed");
      }
      onRemoved();
    } catch (e) {
      setError(e.message);
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-theme-200/50 dark:border-white/10 flex items-center gap-2">
        <span className="font-medium text-theme-700 dark:text-theme-200 flex-1 truncate">{tag}</span>
        <button
          type="button"
          disabled={pulling || tag === "<none>:<none>"}
          onClick={handlePull}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5 disabled:opacity-40"
          title="Pull latest"
        >
          <FiDownload className={pulling ? "animate-bounce" : ""} />
          {pulling ? "Pulling..." : "Pull"}
        </button>
        <button
          type="button"
          disabled={removing || image.usedBy > 0}
          onClick={handleRemove}
          className={classNames(
            "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors disabled:opacity-40",
            confirmRemove
              ? "bg-rose-500/20 text-rose-500"
              : "text-theme-500 dark:text-theme-400 hover:bg-theme-200/20 dark:hover:bg-white/5",
          )}
          title={image.usedBy > 0 ? "In use by containers" : "Remove image"}
        >
          <FiTrash2 />
          {confirmRemove ? "Confirm?" : "Remove"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-1.5 text-xs text-rose-500 bg-rose-500/10">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
        <Section title="General">
          <KV label="ID" value={shortId} />
          <KV label="Size" value={formatBytes(image.size)} />
          <KV label="Created" value={image.created ? new Date(image.created * 1000).toLocaleString() : "-"} />
        </Section>

        <Section title={`Usage (${image.containers?.length || 0})`}>
          {image.containers?.length > 0 ? (
            image.containers.map((name) => (
              <div key={name} className="py-0.5">{name}</div>
            ))
          ) : (
            <div className="text-theme-400 italic">No containers using this image</div>
          )}
        </Section>

        {image.repoTags?.length > 0 && (
          <Section title="Tags">
            {image.repoTags.map((t) => (
              <div key={t} className="py-0.5">{t}</div>
            ))}
          </Section>
        )}
        {image.repoDigests?.length > 0 && (
          <Section title="Digests">
            {image.repoDigests.map((d) => (
              <div key={d} className="py-0.5 break-all">{d}</div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

export default function ImagesGroup({ icon, server }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);

  const topic = `docker:images:${server}`;
  const fallbackUrl = `/api/docker/images?server=${encodeURIComponent(server)}`;
  const { data: images, mutate } = useWidgetWS(topic, fallbackUrl);

  const sorted = useMemo(() => {
    if (!Array.isArray(images)) return [];
    // Always hide dangling in the sidebar
    let list = images.filter((img) => img.repoTags?.length > 0 && img.repoTags[0] !== "<none>:<none>");
    if (filter) {
      const lower = filter.toLowerCase();
      list = list.filter((img) =>
        img.repoTags?.some((t) => t.toLowerCase().includes(lower)) ||
        img.id?.toLowerCase().includes(lower),
      );
    }
    return [...list].sort((a, b) => {
      const aName = a.repoTags?.[0] || a.id;
      const bName = b.repoTags?.[0] || b.id;
      return aName.localeCompare(bName);
    });
  }, [images, filter]);

  const count = Array.isArray(images) ? images.length : null;
  const danglingCount = Array.isArray(images)
    ? images.filter((img) => !img.repoTags?.length || img.repoTags[0] === "<none>:<none>").length
    : 0;

  async function handlePruneDangling() {
    setPruning(true);
    setPruneResult(null);
    try {
      const r = await fetch(`/api/docker/images/prune?server=${encodeURIComponent(server)}`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Prune failed");
      setPruneResult(`Removed ${data.deleted} image${data.deleted !== 1 ? "s" : ""}, reclaimed ${formatBytes(data.spaceReclaimed)}`);
      mutate();
    } catch (e) {
      setPruneResult(e.message);
    } finally {
      setPruning(false);
    }
  }

  return (
    <DockerGroup icon={icon} title="Images" count={count}>
      <div className="flex gap-4 h-[28rem]">
        <aside className="w-72 flex-shrink-0 rounded-md bg-theme-100/20 dark:bg-white/5 flex flex-col overflow-hidden">
          <div className="p-2 space-y-1">
            <input
              type="text"
              placeholder="Filter images..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded bg-theme-200/30 dark:bg-white/5 border border-theme-200/50 dark:border-white/10 text-theme-700 dark:text-theme-200 placeholder:text-theme-400 dark:placeholder:text-theme-500 focus:outline-none focus:ring-1 focus:ring-theme-300 dark:focus:ring-white/20"
            />
            {danglingCount > 0 && (
              <button
                type="button"
                disabled={pruning}
                onClick={handlePruneDangling}
                className="flex items-center gap-1 w-full px-2 py-1 text-xs rounded text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
              >
                <FiTrash2 className="text-[10px]" />
                {pruning ? "Removing..." : `Remove dangling (${danglingCount})`}
              </button>
            )}
            {pruneResult && (
              <div className="px-2 text-xs text-theme-500 dark:text-theme-400">{pruneResult}</div>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5">
            {sorted.map((img) => {
              const tag = img.repoTags?.[0] || "<none>:<none>";
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    className={classNames(
                      "w-full text-left px-3 py-2 cursor-pointer rounded transition-colors",
                      selected?.id === img.id
                        ? "bg-theme-300/20 dark:bg-white/10"
                        : "hover:bg-theme-200/20 dark:hover:bg-white/5",
                    )}
                    onClick={() => setSelected(img)}
                  >
                    <span className="text-sm font-medium truncate block text-theme-700 dark:text-theme-200">{tag}</span>
                    <span className="text-xs text-theme-500 dark:text-theme-400">{formatBytes(img.size)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <div className="flex-1 flex flex-col rounded-md bg-theme-100/20 dark:bg-white/5 overflow-hidden">
          <ImageContent
            image={selected}
            server={server}
            onRemoved={() => {
              setSelected(null);
              mutate();
            }}
          />
        </div>
      </div>
    </DockerGroup>
  );
}
