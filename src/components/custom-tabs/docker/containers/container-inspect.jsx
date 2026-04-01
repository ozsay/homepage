import { useEffect, useState } from "react";

function Section({ title, children }) {
  return (
    <div className="mb-3">
      <h4 className="text-xs font-bold uppercase text-theme-700 dark:text-theme-200 mb-1">{title}</h4>
      <div className="text-xs text-theme-500 dark:text-theme-300 font-light">{children}</div>
    </div>
  );
}

function KeyValue({ label, value }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="font-medium text-theme-600 dark:text-theme-300 min-w-[120px] shrink-0">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

function MaskedValue({ value }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <button type="button" onClick={() => setRevealed(!revealed)} className="text-left break-all hover:text-theme-700 dark:hover:text-theme-200">
      {revealed ? value : "••••••••"}
    </button>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-bold uppercase text-theme-700 dark:text-theme-200 mb-1"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>&#9654;</span>
        {title}
      </button>
      {open && <div className="text-xs text-theme-500 dark:text-theme-300 font-light pl-3">{children}</div>}
    </div>
  );
}

export default function ContainerInspect({ container, server }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/docker/containers/${encodeURIComponent(container.name)}/inspect?server=${encodeURIComponent(server)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [container.name, server]);

  if (loading) {
    return <div className="text-theme-500 dark:text-theme-400 text-xs p-4 text-center">Loading...</div>;
  }

  if (!data || data.error) {
    return <div className="text-theme-500 dark:text-theme-400 text-xs p-4 text-center">Failed to load inspect data</div>;
  }

  return (
    <div className="px-3 py-2 max-h-[32rem] overflow-y-auto">
      <Section title="General">
        <KeyValue label="ID" value={data.id?.slice(0, 24)} />
        <KeyValue label="Created" value={data.created ? new Date(data.created).toLocaleString() : "-"} />
        <KeyValue label="Image" value={data.image} />
        <KeyValue label="Restart Policy" value={data.restartPolicy ? `${data.restartPolicy.Name} (max: ${data.restartPolicy.MaximumRetryCount})` : "-"} />
        {data.entrypoint && <KeyValue label="Entrypoint" value={Array.isArray(data.entrypoint) ? data.entrypoint.join(" ") : data.entrypoint} />}
        {data.command && <KeyValue label="Command" value={Array.isArray(data.command) ? data.command.join(" ") : data.command} />}
      </Section>

      {data.ports?.length > 0 && (
        <Section title="Ports">
          {data.ports.map((p) => (
            <KeyValue key={p.container} label={p.container} value={p.host || "not published"} />
          ))}
        </Section>
      )}

      {data.mounts?.length > 0 && (
        <Section title="Mounts">
          {data.mounts.map((m) => (
            <div key={`${m.source}-${m.destination}`} className="py-0.5">
              <span className="font-medium text-theme-600 dark:text-theme-300">{m.source}</span>
              <span className="mx-1">&rarr;</span>
              <span>{m.destination}</span>
              <span className="ml-1 text-theme-400">({m.mode})</span>
            </div>
          ))}
        </Section>
      )}

      {data.networks?.length > 0 && (
        <Section title="Networks">
          {data.networks.map((n) => (
            <KeyValue key={n.name} label={n.name} value={`${n.ip}${n.aliases?.length ? ` (${n.aliases.join(", ")})` : ""}`} />
          ))}
        </Section>
      )}

      {data.env?.length > 0 && (
        <CollapsibleSection title={`Environment (${data.env.length})`} defaultOpen={false}>
          {data.env.map((e) => (
            <div key={e.key} className="flex gap-2 py-0.5">
              <span className="font-medium text-theme-600 dark:text-theme-300 min-w-[120px] shrink-0">{e.key}</span>
              <MaskedValue value={e.value} />
            </div>
          ))}
        </CollapsibleSection>
      )}

      {data.labels && Object.keys(data.labels).length > 0 && (
        <CollapsibleSection title={`Labels (${Object.keys(data.labels).length})`} defaultOpen={false}>
          {Object.entries(data.labels).map(([k, v]) => (
            <KeyValue key={k} label={k} value={v} />
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}
