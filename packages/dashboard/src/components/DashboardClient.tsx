"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import CostChart from "./CostChart";
import CallsTable from "./CallsTable";

interface DayStat {
  date: string;
  total_cost: string;
  call_count: string;
}

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

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

interface Props {
  user: { name: string; email: string };
  workspaceId: string;
  dailyStats: DayStat[];
  calls: Call[];
  initialApiKeys: ApiKey[];
}

export default function DashboardClient({ user, dailyStats, calls, initialApiKeys }: Props) {
  const router = useRouter();

  const totalCost30d = dailyStats.reduce((sum, d) => sum + parseFloat(d.total_cost), 0);
  const totalCalls30d = dailyStats.reduce((sum, d) => sum + parseInt(d.call_count, 10), 0);
  const today = dailyStats.find((d) => d.date === new Date().toISOString().slice(0, 10));

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">Inferlog</span>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{user.email}</span>
          <button onClick={handleSignOut} className="hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card label="Cost (30d)" value={`$${totalCost30d.toFixed(4)}`} />
          <Card label="Calls (30d)" value={totalCalls30d.toLocaleString()} />
          <Card
            label="Cost (today)"
            value={today ? `$${parseFloat(today.total_cost).toFixed(4)}` : "$0.0000"}
          />
        </div>

        {/* Chart */}
        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Daily Cost — last 30 days</h2>
          <CostChart data={dailyStats} />
        </section>

        {/* Calls table */}
        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Recent Calls (last 100)</h2>
          <CallsTable calls={calls} />
        </section>

        {/* API Keys */}
        <ApiKeysSection initialKeys={initialApiKeys} />
      </main>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

// ── API Keys Section ──────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

function ApiKeysSection({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create key");
      }
      const data = await res.json() as ApiKey & { key: string };
      setCreatedKey(data.key);
      setKeys((prev) => [{ id: data.id, key_prefix: data.key_prefix, name: data.name, created_at: data.created_at, last_used_at: null }, ...prev]);
      setNewKeyName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke");
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (createdKey) setCreatedKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-sm font-medium text-gray-400 mb-4">API Keys</h2>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Key name"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          disabled={creating || !newKeyName.trim()}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </form>

      {/* One-time key reveal */}
      {createdKey && (
        <div className="mb-4 p-4 bg-gray-800 border border-green-700 rounded-lg">
          <p className="text-xs text-green-400 mb-2 font-medium">
            Copy this key now — it will not be shown again.
          </p>
          <code className="text-sm text-green-300 break-all">{createdKey}</code>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-2 block text-xs text-gray-500 hover:text-gray-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Prefix</th>
                <th className="pb-2 pr-4 font-medium">Created</th>
                <th className="pb-2 pr-4 font-medium">Last used</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-gray-800 last:border-0">
                  <td className="py-2 pr-4 text-gray-200">{k.name}</td>
                  <td className="py-2 pr-4 font-mono text-gray-400">{k.key_prefix}…</td>
                  <td className="py-2 pr-4 text-gray-400">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
