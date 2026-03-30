"use client";

interface Call {
  id: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: string | null;
  latency_ms: number | null;
  timestamp: string;
  tag: string | null;
  status_code: number | null;
}

interface Props {
  calls: Call[];
}

const PROVIDER_COLORS: Record<string, string> = {
  openai:    "bg-emerald-900 text-emerald-300",
  anthropic: "bg-amber-900 text-amber-300",
};

export default function CallsTable({ calls }: Props) {
  if (calls.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-8 text-center">
        No calls recorded yet. Point your LLM client at the proxy to start logging.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gray-800">
            <th className="pb-2 pr-4 font-medium">Time</th>
            <th className="pb-2 pr-4 font-medium">Provider</th>
            <th className="pb-2 pr-4 font-medium">Model</th>
            <th className="pb-2 pr-4 font-medium text-right">In</th>
            <th className="pb-2 pr-4 font-medium text-right">Out</th>
            <th className="pb-2 pr-4 font-medium text-right">Cost</th>
            <th className="pb-2 pr-4 font-medium text-right">Latency</th>
            <th className="pb-2 font-medium">Tag</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => {
            const colorClass = PROVIDER_COLORS[c.provider] ?? "bg-gray-800 text-gray-300";
            const ts = new Date(c.timestamp);
            const timeStr = ts.toLocaleString(undefined, {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            });

            return (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{timeStr}</td>
                <td className="py-2 pr-4">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                    {c.provider}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-200">{c.model}</td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {c.input_tokens != null ? c.input_tokens.toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {c.output_tokens != null ? c.output_tokens.toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4 text-right text-gray-200">
                  {c.cost_usd != null ? `$${parseFloat(c.cost_usd).toFixed(5)}` : "—"}
                </td>
                <td className="py-2 pr-4 text-right text-gray-400">
                  {c.latency_ms != null ? `${c.latency_ms}ms` : "—"}
                </td>
                <td className="py-2">
                  {c.tag ? (
                    <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">
                      {c.tag}
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
