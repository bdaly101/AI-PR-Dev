import { getAuditLogs } from "@/lib/db";
import { format, parseISO } from "date-fns";
import { Check, X, Clock, Zap } from "lucide-react";

function getActionIcon(action: string) {
  if (action.includes("failed")) return X;
  if (action.includes("denied")) return X;
  return Check;
}

function getActionColor(action: string, success: number) {
  if (!success || action.includes("failed") || action.includes("denied")) {
    return "text-red-400 bg-red-400/10";
  }
  return "text-emerald-400 bg-emerald-400/10";
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/command /g, "")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function JobsPage() {
  let logs: Awaited<ReturnType<typeof getAuditLogs>> = [];

  try {
    logs = getAuditLogs({ limit: 100 });
  } catch {
    logs = [];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Job Logs</h1>
        <p className="mt-2 text-zinc-400">
          Activity log for all AI operations
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
          <option value="">All Actions</option>
          <option value="pr_reviewed">PR Reviewed</option>
          <option value="change_plan">Change Plans</option>
          <option value="command">Commands</option>
        </select>
        <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-zinc-600" />
            <p className="mt-4 text-zinc-500">
              No job logs found. Activity will appear here as the AI processes
              requests.
            </p>
          </div>
        ) : (
          logs.map((log) => {
            const Icon = getActionIcon(log.action);
            const colorClass = getActionColor(log.action, log.success);

            return (
              <div
                key={log.id}
                className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className={`rounded-full p-2 ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">
                      {formatAction(log.action)}
                    </p>
                    <span className="text-sm text-zinc-500">
                      {format(parseISO(log.timestamp), "MMM d, HH:mm:ss")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-zinc-400">
                    {log.owner && log.repo && (
                      <span>
                        {log.owner}/{log.repo}
                      </span>
                    )}
                    {log.pull_number && <span>PR #{log.pull_number}</span>}
                    {log.triggered_by && (
                      <span>by @{log.triggered_by}</span>
                    )}
                    {log.ai_model && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
                        {log.ai_model}
                      </span>
                    )}
                  </div>
                  {log.error_message && (
                    <p className="mt-2 text-sm text-red-400">
                      Error: {log.error_message}
                    </p>
                  )}
                  {log.files_changed && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Files: {log.files_changed.split(",").length} changed
                      {log.lines_added !== null && (
                        <> • +{log.lines_added}/-{log.lines_deleted}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

