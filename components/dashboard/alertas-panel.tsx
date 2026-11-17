import Link from 'next/link'
import { AlertTriangle, XCircle } from 'lucide-react'
import type { Alerta } from '@/lib/alertas'

export function AlertasPanel({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null

  return (
    <section aria-label="Pendências" className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
      <h2 className="flex items-center gap-2 bg-amber-100/70 px-4 py-2.5 text-sm font-semibold text-amber-950">
        <AlertTriangle size={15} aria-hidden="true" />
        {alertas.length === 1
          ? '1 pendência precisa de atenção'
          : `${alertas.length} pendências precisam de atenção`}
      </h2>
      <ul className="space-y-2 px-4 py-3">
        {alertas.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug text-tinta-suave">
            {/* nível nunca só pela cor: o ícone muda junto */}
            {a.nivel === 'erro'
              ? <XCircle size={15} aria-label="Erro" className="mt-0.5 shrink-0 text-negativo" />
              : <AlertTriangle size={15} aria-label="Aviso" className="mt-0.5 shrink-0 text-amber-600" />}
            <span className="min-w-0 break-words">
              {a.mensagem}
              {a.href && (
                <>
                  {' '}
                  <Link href={a.href} className="font-semibold text-marca-700 underline underline-offset-2">
                    Resolver
                  </Link>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
