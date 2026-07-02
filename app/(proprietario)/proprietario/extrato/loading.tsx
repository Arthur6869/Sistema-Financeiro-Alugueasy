import { Skeleton } from '@/components/ui/skeleton'

export default function ExtratoLoading() {
  return (
    <div className="max-w-[1100px] mx-auto px-7 pt-8 pb-16 w-full">
      {/* Cabeçalho + seletor de período */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Cards de apartamento */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="px-5 py-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-b-0">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
