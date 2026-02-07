'use client';

export default function SkeletonLoader() {
  return (
    <div className="space-y-4 w-full max-w-lg mx-auto">
      {/* Hero skeleton */}
      <div className="glass-strong p-8 text-center space-y-4">
        <div className="skeleton h-4 w-32 mx-auto" />
        <div className="skeleton h-8 w-20 mx-auto" />
        <div className="skeleton h-24 w-48 mx-auto" />
        <div className="skeleton h-4 w-36 mx-auto" />
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      </div>

      {/* Details skeleton */}
      <div className="glass p-6 space-y-3">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-2 w-full" />
        <div className="skeleton h-2 w-3/4" />
      </div>

      {/* Sources skeleton */}
      <div className="glass p-5">
        <div className="skeleton h-4 w-32 mb-3" />
        <div className="flex gap-2">
          <div className="skeleton h-8 w-28 rounded-full" />
          <div className="skeleton h-8 w-24 rounded-full" />
          <div className="skeleton h-8 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}
