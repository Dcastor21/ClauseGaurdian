type Variant = 'row' | 'gauge' | 'card'

export function Skeleton({ variant }: { variant: Variant }) {
  if (variant === 'row') {
    return (
      <div className="flex items-center gap-4 py-3 border-b border-gray-100 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-36 shrink-0" />
        <div className="h-3 bg-gray-100 rounded w-20 shrink-0" />
        <div className="h-5 bg-gray-100 rounded w-16 shrink-0" />
        <div className="h-5 bg-gray-100 rounded w-14 shrink-0" />
        <div className="h-3 bg-gray-100 rounded w-10 shrink-0" />
        <div className="ml-auto h-4 w-4 bg-gray-100 rounded shrink-0" />
      </div>
    )
  }

  if (variant === 'gauge') {
    return (
      <div className="flex flex-col items-center gap-2 animate-pulse">
        <div className="w-40 h-24 bg-gray-100 rounded" />
        <div className="h-4 bg-gray-200 rounded w-24" />
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white animate-pulse">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-5 bg-gray-100 rounded w-14 shrink-0" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        <div className="h-4 w-4 bg-gray-100 rounded shrink-0 ml-2" />
      </div>
    </div>
  )
}
