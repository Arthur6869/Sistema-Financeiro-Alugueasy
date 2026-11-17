import { Skeleton } from '@/components/ui/skeleton'

// Mesmo desenho da tela pronta (saudação, quatro números, evolução, ocupação),
// para o conteúdo não "pular" quando os dados chegam.
export default function ProprietarioLoading() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-creme px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Carregando o resumo dos seus imóveis">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-11 w-64 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-64 rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`space-y-4 rounded-2xl border border-linha bg-white p-5 ${i === 0 || i === 3 ? 'col-span-2 xl:col-span-1' : ''}`}>
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-8 w-40 max-w-full" />
                <Skeleton className="h-3.5 w-36 max-w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-5 rounded-2xl border border-linha bg-white p-5">
            <Skeleton className="h-4 w-56" />
            <div className="flex h-52 items-end gap-3">
              {[40, 55, 48, 70, 62, 85].map((h, i) => <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />)}
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-linha bg-white p-5">
            <Skeleton className="h-4 w-48" />
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-16">
              {Array.from({ length: 31 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
