import { auth } from "@/auth";
import { StatsCard } from "@/components/stats-card";
import { ReviewsChart } from "@/components/chart";
import { getMetricsSummary, getRepositories } from "@/lib/db";
import {
  Eye,
  GitPullRequest,
  Clock,
  AlertCircle,
  FolderGit2,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  
  // Get metrics
  let metrics: ReturnType<typeof getMetricsSummary> = {
    totalReviews: 0,
    totalFailed: 0,
    totalPRsCreated: 0,
    avgDuration: 0,
    reviewsByDay: [],
  };
  let repos: ReturnType<typeof getRepositories> = [];
  
  try {
    metrics = getMetricsSummary({ days: 30 });
    repos = getRepositories();
  } catch {
    // Database might not exist yet - use defaults
  }

  const successRate =
    metrics.totalReviews > 0
      ? Math.round(
          ((metrics.totalReviews - metrics.totalFailed) / metrics.totalReviews) *
            100
        )
      : 100;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {session?.user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-2 text-zinc-400">
          Here&apos;s what&apos;s happening with your AI code reviews
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Reviews"
          value={metrics.totalReviews}
          description="Last 30 days"
          icon={Eye}
        />
        <StatsCard
          title="PRs Created"
          value={metrics.totalPRsCreated}
          description="By AI Dev Agent"
          icon={GitPullRequest}
        />
        <StatsCard
          title="Success Rate"
          value={`${successRate}%`}
          description="Reviews completed"
          icon={AlertCircle}
        />
        <StatsCard
          title="Avg Duration"
          value={`${(metrics.avgDuration / 1000).toFixed(1)}s`}
          description="Per review"
          icon={Clock}
        />
      </div>

      {/* Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReviewsChart data={metrics.reviewsByDay} title="Reviews Over Time" />
        </div>

        {/* Repositories */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Active Repositories
          </h3>
          <div className="space-y-3">
            {repos.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No repositories reviewed yet
              </p>
            ) : (
              repos.slice(0, 5).map((repo) => (
                <div
                  key={`${repo.owner}/${repo.repo}`}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FolderGit2 className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {repo.repo}
                      </p>
                      <p className="text-xs text-zinc-500">{repo.owner}</p>
                    </div>
                  </div>
                  <span className="text-sm text-zinc-400">
                    {repo.reviewCount} reviews
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

