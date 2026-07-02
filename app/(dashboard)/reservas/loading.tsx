import { Skeleton } from '@/components/ui/skeleton'

export default function ReservasLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24 ml-auto" />
        </div>
        {/* Header da tabela */}
        <div className="flex gap-4 border-b border-gray-100 pb-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Linhas */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
