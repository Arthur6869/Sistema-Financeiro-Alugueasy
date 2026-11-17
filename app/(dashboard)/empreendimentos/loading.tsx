import { Skeleton } from '@/components/ui/skeleton'

// Mesmo desenho da tela pronta (cabeçalho, ranking, grade de cartões), para o
// conteúdo não "pular" quando os dados chegam.
export default function EmpreendimentosLoading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-creme px-4 pb-16 pt-5 sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1400px]" aria-busy="true" aria-label="Carregando empreendimentos">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-72 max-w-full" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-64 rounded-full" />
            <Skeleton className="h-11 w-44 rounded-full" />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-4 rounded-2xl border border-linha bg-white p-5">
            <Skeleton className="h-4 w-72 max-w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32 shrink-0" />
                <Skeleton className="h-5 flex-1" style={{ maxWidth: `${90 - i * 12}%` }} />
              </div>
            ))}
          </div>

          <div className="grid gap-4 rounded-2xl border border-linha bg-white p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-linha p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-xl" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
