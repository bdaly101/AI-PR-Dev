import { auth } from "@/auth";
import { ExternalLink } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-2 text-zinc-400">Manage your dashboard preferences</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Your GitHub account information
        </p>

        <div className="mt-6 flex items-center gap-4">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name || "Profile"}
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <p className="text-lg font-medium text-white">
              {session?.user?.name}
            </p>
            <p className="text-sm text-zinc-400">@{session?.user?.login}</p>
            <p className="text-sm text-zinc-500">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">
          Repository Configuration
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Configure the AI PR Reviewer for your repositories
        </p>

        <div className="mt-6 space-y-4">
          <p className="text-sm text-zinc-400">
            To configure the AI PR Reviewer for a repository, add a{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-violet-400">
              .ai-pr-reviewer.yml
            </code>{" "}
            file to the repository root.
          </p>

          <div className="rounded-lg bg-zinc-800/50 p-4">
            <p className="mb-2 text-sm font-medium text-white">
              Example configuration:
            </p>
            <pre className="overflow-x-auto text-xs text-zinc-300">
              {`version: 1
enabled: true
mode: both  # 'reviewer', 'dev-agent', or 'both'

reviewer:
  strictness: normal  # 'lenient', 'normal', 'strict'
  minSeverity: low
  maxFilesReviewed: 50
  ignorePaths:
    - "*.test.ts"
    - "*.spec.ts"

ai:
  provider: openai
  model: gpt-4-turbo-preview
  temperature: 0.3

devAgent:
  enabled: true
  maxFilesPerPR: 10
  maxLinesChanged: 200`}
            </pre>
          </div>

          <a
            href={`${process.env.NEXT_PUBLIC_REPOSITORY_URL || "https://github.com/bdaly101/AI-PR-Dev"}/blob/main/docs/configuration.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300"
          >
            View full documentation
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* About Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-semibold text-white">About</h2>
        <p className="mt-1 text-sm text-zinc-500">
          AI PR Reviewer & Dev Agent
        </p>

        <div className="mt-6 space-y-3 text-sm text-zinc-400">
          <p>
            An intelligent GitHub App that automatically reviews pull requests
            using AI and can make code improvements via the Dev Agent.
          </p>
          <div className="flex items-center gap-4">
            <a
              href={process.env.NEXT_PUBLIC_REPOSITORY_URL || "https://github.com/bdaly101/AI-PR-Dev"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300"
            >
              GitHub Repository
            </a>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">v1.2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

