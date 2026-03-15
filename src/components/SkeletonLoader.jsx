/**
 * SkeletonLoader.jsx
 * Layout-mirroring skeleton loaders for perceived performance.
 * Skeletons exactly match the final UI layout — no page shift on load.
 */

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`bg-salden-hover rounded-lg animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-salden-surface border border-salden-border rounded-2xl p-5">
            <SkeletonBlock className="h-3 w-24 mb-3" />
            <SkeletonBlock className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Table header */}
      <div className="bg-salden-surface border border-salden-border rounded-2xl">
        <div className="p-5 border-b border-salden-border flex items-center justify-between">
          <SkeletonBlock className="h-5 w-32" />
          <div className="flex gap-3">
            <SkeletonBlock className="h-9 w-44 rounded-xl" />
            <SkeletonBlock className="h-9 w-36 rounded-xl" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-salden-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <SkeletonBlock className="h-4 w-6 flex-shrink-0" />
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ComplianceSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-8 flex flex-col items-center gap-4">
        <SkeletonBlock className="h-24 w-24 rounded-full" />
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="h-4 w-56" />
      </div>
      <div className="bg-salden-surface border border-salden-border rounded-2xl p-5">
        <SkeletonBlock className="h-4 w-48 mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-salden-border last:border-0">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-salden-surface border border-salden-border rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-3 w-72" />
          </div>
          <SkeletonBlock className="h-10 w-28 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export default SkeletonBlock;
