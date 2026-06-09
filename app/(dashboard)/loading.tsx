export default function DashboardLoading() {
  return (
    <div className="p-8 w-full animate-pulse">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-3">
          <div className="h-8 w-32 bg-gray-100 rounded-lg" />
          <div className="h-6 w-48 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-48 bg-gray-100 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
            <div className="h-9 w-36 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-100 rounded mb-5" />
            <div className="h-1.5 w-full bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8 h-80" />

      <div className="h-5 w-48 bg-gray-100 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 h-24" />
        ))}
      </div>
    </div>
  )
}
