"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { GoalsSection } from "@/components/goals/goals-section";
import { ProjectsSection } from "@/components/projects/projects-section";

interface UserProfile {
  id: string;
  email: string | null;
  role: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [archived, setArchived] = useState(false);

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery<UserProfile>({
    queryKey: ["user-profile", user?.id],
    queryFn: () => apiClient<UserProfile>("/api/v1/auth/me"),
    enabled: !!user,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: () =>
      apiClient<UserProfile>("/api/v1/auth/complete-onboarding", {
        method: "POST",
      }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["user-profile", user?.id], updatedProfile);
    },
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    router.push("/login");
  };

  if (authLoading || (profileLoading && !profileError)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-sm text-muted-foreground animate-pulse">
          Authenticating with Continuum API...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Continuum</h1>
          <p className="text-xs text-muted-foreground">
            Authenticated User Space
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {profile?.email || user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-4xl space-y-6">
        {profileError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
            Failed to load profile from FastAPI: {String(profileError)}
          </div>
        )}

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold">Authentication Boundary Status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            FastAPI verified the JWT token and resolved your tenant isolation context:
          </p>

          <div className="mt-4 space-y-2 rounded-md bg-muted/50 p-4 font-mono text-xs">
            <div>
              <span className="text-muted-foreground">User UUID (user_id): </span>
              <span className="font-bold text-primary">{profile?.id || user?.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span>{profile?.email || user?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Onboarding Status: </span>
              <span className={profile?.onboarding_completed_at ? "text-green-600 dark:text-green-400 font-semibold" : "text-amber-600 dark:text-amber-400"}>
                {profile?.onboarding_completed_at
                  ? `Completed (${new Date(profile.onboarding_completed_at).toLocaleString()})`
                  : "Pending"}
              </span>
            </div>
          </div>

          {!profile?.onboarding_completed_at && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => completeOnboardingMutation.mutate()}
                disabled={completeOnboardingMutation.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {completeOnboardingMutation.isPending
                  ? "Saving..."
                  : "Mark Onboarding Complete"}
              </button>
            </div>
          )}
        </div>

        {/* Milestone 2: Goals & Projects Slices */}
        <nav aria-label="Workspace views" className="flex gap-2">
          <button className="rounded-md border px-3 py-2" aria-pressed={!archived} onClick={() => setArchived(false)}>Workspace</button>
          <button className="rounded-md border px-3 py-2" aria-pressed={archived} onClick={() => setArchived(true)}>Archive</button>
        </nav>
        {archived && <p className="text-sm text-muted-foreground">Completed goals and completed or abandoned projects move here after two days.</p>}
        <div className="grid gap-6 md:grid-cols-2">
          <GoalsSection key={`goals-${user?.id}-${archived}`} archived={archived} />
          <ProjectsSection key={`projects-${user?.id}-${archived}`} archived={archived} />
        </div>
      </main>
    </div>
  );
}
