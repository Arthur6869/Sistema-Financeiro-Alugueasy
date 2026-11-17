import { Skeleton } from '@/components/ui/skeleton'

// Mesmo desenho da tela pronta (dois gráficos e a tabela dos 12 meses).
export default function HistoricoLoading() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-creme px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1100px]" aria-busy="true" aria-label="Carregando o histórico">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="mt-6 space-y-4">
          {Array.from({ length: 2 }).map((_, c) => (
            <div key={c} className="space-y-5 rounded-2xl border border-linha bg-white p-5">
              <Skeleton className="h-4 w-56" />
              <div className="flex h-52 items-end gap-2">
                {[30, 42, 38, 55, 48, 60, 52, 70, 64, 80, 74, 40].map((h, i) => <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />)}
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-linha bg-white">
            <div className="border-b border-linha px-5 py-4"><Skeleton className="h-4 w-44" /></div>
            <div className="space-y-4 p-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
