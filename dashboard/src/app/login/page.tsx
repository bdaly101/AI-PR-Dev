import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { Github } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <span className="text-2xl font-bold text-white">AI</span>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">
            AI PR Reviewer
          </h1>
          <p className="mt-2 text-zinc-400">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Sign In Button */}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <Github className="h-5 w-5" />
            Sign in with GitHub
          </button>
        </form>

        {/* Info */}
        <p className="text-center text-xs text-zinc-500">
          By signing in, you agree to allow this application to access your
          GitHub profile and organization information for authentication
          purposes.
        </p>
      </div>
    </div>
  );
}

