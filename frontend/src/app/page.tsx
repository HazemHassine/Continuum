export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Tracker</h1>
        <p className="text-muted-foreground text-sm">
          A deliberately small, handcrafted personal tracking app for goals,
          projects, notes, references, and life events.
        </p>
        <div className="p-4 border rounded-lg bg-card text-card-foreground text-xs space-y-2">
          <div className="font-semibold text-primary">Architecture Scaffold (M0)</div>
          <div className="text-muted-foreground">
            Frontend: Next.js + Tailwind + TanStack Query + Supabase Auth
          </div>
          <div className="text-muted-foreground">
            Backend: FastAPI + SQLAlchemy + Alembic
          </div>
        </div>
      </div>
    </main>
  );
}
