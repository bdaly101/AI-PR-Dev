import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, GitPullRequest, Zap, Shield } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <span className="text-lg font-semibold text-white">
              PR Reviewer
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
            AI-Powered
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              {" "}
              Code Reviews
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Automate your code reviews with GPT-4. Get instant feedback on pull
            requests, catch bugs before they ship, and let AI fix common issues
            automatically.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 font-medium text-white transition-colors hover:bg-violet-500"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/bdaly101/AI-PR-Dev"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-700 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-800"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10">
              <Eye className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              Automated Reviews
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Every PR gets instant AI-powered code review with actionable
              feedback.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-fuchsia-500/10">
              <GitPullRequest className="h-6 w-6 text-fuchsia-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              Dev Agent
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              AI can fix lint errors, add types, and improve documentation
              automatically.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
              <Zap className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              Slash Commands
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Control the AI with simple commands like /ai-review and
              /ai-fix-lints.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <Shield className="h-6 w-6 text-amber-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              Safe & Controlled
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              All AI changes require approval. Built-in safety limits and
              rollback.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-zinc-500">
          Built with ❤️ using Next.js, TypeScript, and GPT-4
        </div>
      </footer>
    </div>
  );
}
