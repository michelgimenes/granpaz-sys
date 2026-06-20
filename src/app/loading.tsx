// Skeleton de carregamento para a landing page (§3.1)
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="h-7 w-24 bg-muted animate-pulse rounded" />
          <div className="flex gap-3">
            <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <main className="flex-1">
        <section className="relative min-h-[85vh] flex items-center">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="max-w-3xl space-y-6">
              <div className="h-5 w-64 bg-muted animate-pulse rounded" />
              <div className="h-14 w-full bg-muted animate-pulse rounded" />
              <div className="h-14 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-6 w-full bg-muted animate-pulse rounded" />
              <div className="h-6 w-5/6 bg-muted animate-pulse rounded" />
              <div className="flex gap-4 pt-4">
                <div className="h-12 w-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-12 w-40 bg-muted animate-pulse rounded-lg" />
              </div>
            </div>
          </div>
        </section>

        {/* Benefits skeleton */}
        <section className="py-16 px-4">
          <div className="mx-auto max-w-7xl space-y-8">
            <div className="h-10 w-96 mx-auto bg-muted animate-pulse rounded" />
            <div className="grid sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer skeleton */}
      <div className="border-t border-border/50 p-8">
        <div className="h-24 bg-muted animate-pulse rounded-xl max-w-7xl mx-auto" />
      </div>
    </div>
  )
}
