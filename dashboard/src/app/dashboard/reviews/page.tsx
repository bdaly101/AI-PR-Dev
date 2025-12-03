import { getReviews, getRepositories } from "@/lib/db";
import { format, parseISO } from "date-fns";
import { ExternalLink, Check, X } from "lucide-react";

export default async function ReviewsPage() {
  let reviews: Awaited<ReturnType<typeof getReviews>> = [];
  let repos: Awaited<ReturnType<typeof getRepositories>> = [];

  try {
    reviews = getReviews({ limit: 100 });
    repos = getRepositories();
  } catch {
    reviews = [];
    repos = [];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Review History</h1>
          <p className="mt-2 text-zinc-400">
            All AI code reviews across your repositories
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
          <option value="">All Repositories</option>
          {repos.map((repo) => (
            <option key={`${repo.owner}/${repo.repo}`} value={repo.repo}>
              {repo.owner}/{repo.repo}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Repository
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                PR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Reviewed At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Summary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-900/50">
            {reviews.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-zinc-500"
                >
                  No reviews found. Reviews will appear here once the AI starts
                  reviewing PRs.
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="hover:bg-zinc-800/50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-medium text-white">
                      {review.owner}/{review.repo}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-violet-400">#{review.pull_number}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-400">
                    {format(parseISO(review.reviewed_at), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                      {review.model_used || "unknown"}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-4 text-zinc-400">
                    {review.review_summary || "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <a
                      href={`https://github.com/${review.owner}/${review.repo}/pull/${review.pull_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
                    >
                      View PR
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

