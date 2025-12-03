"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  History,
  FileText,
  Settings,
  LogOut,
  GitPullRequest,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/reviews", label: "Reviews", icon: History },
  { href: "/dashboard/jobs", label: "Job Logs", icon: FileText },
  { href: "/dashboard/plans", label: "Change Plans", icon: GitPullRequest },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface NavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    login?: string;
  };
}

export function Nav({ user }: NavProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-zinc-800 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <span className="text-lg font-semibold text-white">PR Reviewer</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-violet-500/20 text-violet-400"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            {user?.image && (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="h-9 w-9 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.name || user?.login || "User"}
              </p>
              <p className="truncate text-xs text-zinc-500">
                @{user?.login || "unknown"}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

