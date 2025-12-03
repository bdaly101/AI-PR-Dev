import { getChangePlans } from "@/lib/db";
import { format, parseISO } from "date-fns";
import { GitPullRequest, Clock, Check, X, Hourglass } from "lucide-react";

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return Check;
    case "failed":
    case "rejected":
      return X;
    case "executing":
      return Hourglass;
    default:
      return Clock;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "text-emerald-400 bg-emerald-400/10";
    case "failed":
    case "rejected":
      return "text-red-400 bg-red-400/10";
    case "executing":
      return "text-yellow-400 bg-yellow-400/10";
    default:
      return "text-zinc-400 bg-zinc-400/10";
  }
}

export default async function PlansPage() {
  let plans: Awaited<ReturnType<typeof getChangePlans>> = [];

  try {
    plans = getChangePlans({ limit: 50 });
  } catch {
    plans = [];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Change Plans</h1>
        <p className="mt-2 text-zinc-400">
          AI-generated change plans and their status
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="executing">Executing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.length === 0 ? (
          <div className="col-span-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <GitPullRequest className="mx-auto h-12 w-12 text-zinc-600" />
            <p className="mt-4 text-zinc-500">
              No change plans found. Plans will appear here when the AI Dev
              Agent generates them.
            </p>
          </div>
        ) : (
          plans.map((plan) => {
            const Icon = getStatusIcon(plan.status);
            const colorClass = getStatusColor(plan.status);
            let planData;
            try {
              planData = JSON.parse(plan.plan_json);
            } catch {
              planData = { title: "Unknown", files: [] };
            }

            return (
              <div
                key={plan.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white line-clamp-1">
                      {planData.title || `Plan ${plan.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {plan.owner}/{plan.repo} • PR #{plan.pull_number}
                    </p>
                  </div>
                  <div className={`rounded-full p-1.5 ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Status</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs capitalize ${colorClass}`}
                    >
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Files</span>
                    <span className="text-zinc-300">
                      {planData.files?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Triggered by</span>
                    <span className="text-zinc-300">@{plan.triggered_by}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Created</span>
                    <span className="text-zinc-300">
                      {format(parseISO(plan.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                  {plan.pr_number && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Result PR</span>
                      <a
                        href={`https://github.com/${plan.owner}/${plan.repo}/pull/${plan.pr_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300"
                      >
                        #{plan.pr_number}
                      </a>
                    </div>
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

