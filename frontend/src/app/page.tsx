"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Continuum</h1>
          <p className="text-sm text-muted-foreground">
            A deliberately small, handcrafted personal tracking app for goals,
            projects, notes, references, and life events.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          {!isLoading && user ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Create Account
              </Link>
            </>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4 text-left text-xs space-y-2 text-card-foreground">
          <div className="font-semibold text-primary">Authentication Boundary (M1)</div>
          <div className="text-muted-foreground">
            Supabase Auth &rarr; Next.js Session &rarr; Bearer JWT &rarr; FastAPI Token Verification &rarr; User Scoped Queries
          </div>
        </div>
      </div>
    </main>
  );
}
