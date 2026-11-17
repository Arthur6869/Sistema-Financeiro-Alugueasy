import { Skeleton } from '@/components/ui/skeleton'

// Mesmo desenho da tela pronta (cabeçalho, quatro números, evolução do ano +
// composição, contas), para o conteúdo não "pular" quando os dados chegam.
export default function CustosOperacionaisLoading() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-creme px-4 pb-16 pt-5 sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1400px]" aria-busy="true" aria-label="Carregando custos operacionais">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-11 w-80 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-11 w-64 rounded-full" />
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`space-y-4 rounded-2xl border border-linha bg-white p-5 ${i === 0 || i === 3 ? 'col-span-2 xl:col-span-1' : ''}`}>
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-8 w-40 max-w-full" />
                <Skeleton className="h-3.5 w-44 max-w-full" />
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-5 rounded-2xl border border-linha bg-white p-5">
              <Skeleton className="h-4 w-56" />
              <div className="flex h-52 items-end gap-2">
                {[30, 26, 34, 28, 40, 36, 62, 30, 100, 88, 12, 12].map((h, i) => (
                  <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-linha bg-white p-5">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <Skeleton className="h-2" style={{ width: `${95 - i * 15}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-linha bg-white">
            <div className="space-y-4 border-b border-linha p-5">
              <Skeleton className="h-4 w-44" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-72 max-w-full rounded-full" />
                <Skeleton className="h-10 w-64 rounded-full" />
              </div>
            </div>
            <div className="space-y-4 p-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
