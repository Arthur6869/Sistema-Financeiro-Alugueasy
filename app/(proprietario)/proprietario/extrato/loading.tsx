import { Skeleton } from '@/components/ui/skeleton'

// Mesmo desenho da tela pronta (cabeçalho e um cartão por imóvel).
export default function ExtratoLoading() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-creme px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Carregando a rentabilidade">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-11 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-11 w-64 rounded-full" />
        </div>
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-linha bg-white">
              <div className="flex items-center justify-between border-b border-linha px-5 py-4">
                <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><Skeleton className="h-5 w-48" /></div>
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <div className="px-5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between border-b border-linha/70 py-4 last:border-0">
                    <Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-linha bg-creme/50 px-5 py-4">
                <div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-36" /></div>
                <Skeleton className="h-11 w-32 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
