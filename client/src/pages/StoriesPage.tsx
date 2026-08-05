import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GenNode, type StoriesResponse } from "../api";
import { ErrorBlock, LoadingBlock, PageHeader } from "../components/Layout";

export function StoriesPage() {
  const [data, setData] = useState<StoriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .analyticsStories()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Stories"
        subtitle="Seeded highlight / challenge / prayer cards and demo generation trees."
      />

      {error && <ErrorBlock message={error} />}
      {loading && !data && <LoadingBlock />}

      {data && (
        <>
          <p className="mb-4 text-xs text-slate-500">{data.meta.source}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.stories.map((s) => (
              <article key={s.id} className="dash-panel-solid p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{s.engagement_label}</h2>
                    <p className="text-xs text-slate-500">
                      {s.country} · {s.region}
                    </p>
                  </div>
                  {s.demo_lineage && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                      Demo lineage
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-xs leading-snug text-slate-700">
                  <p>
                    <span className="font-semibold text-emerald-800">Highlight. </span>
                    {s.highlight}
                  </p>
                  <p>
                    <span className="font-semibold text-amber-800">Challenge. </span>
                    {s.challenge}
                  </p>
                  <p>
                    <span className="font-semibold text-sky-800">Prayer. </span>
                    {s.prayer}
                  </p>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-teal-800">
                    Generation tree
                  </summary>
                  <div className="mt-2">
                    <MiniTree node={s.generation_tree} />
                  </div>
                </details>
                <p className="mt-3 text-[11px]">
                  <Link to="/profiles" className="text-teal-700 hover:underline">
                    Match to a live profile →
                  </Link>
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MiniTree({ node, depth = 0 }: { node: GenNode; depth?: number }) {
  return (
    <div className={depth ? "ml-3 border-l border-slate-200 pl-2" : ""}>
      <p className="text-[11px] text-slate-700">
        <span className="font-semibold">{node.name}</span> · {node.role} · G{node.generation}
      </p>
      {node.children?.map((c) => (
        <MiniTree key={`${c.name}-${c.generation}-${c.role}`} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}
