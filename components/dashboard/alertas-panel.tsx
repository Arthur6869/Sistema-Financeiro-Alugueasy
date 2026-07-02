import Link from 'next/link'
import { AlertTriangle, XCircle } from 'lucide-react'
import type { Alerta } from '@/lib/alertas'

export function AlertasPanel({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null

  return (
    <div className="px-8 pt-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 overflow-hidden">
        <div className="px-4 py-2.5 bg-amber-100/60 text-sm font-semibold text-amber-900 flex items-center gap-2">
          <AlertTriangle size={15} />
          {alertas.length} pendência(s) precisam de atenção
        </div>
        <ul className="px-4 py-3 space-y-2">
          {alertas.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              {a.nivel === 'erro'
                ? <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                : <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />}
              <span>
                {a.mensagem}
                {a.href && (
                  <>
                    {' '}
                    <Link href={a.href} className="text-[#193660] font-medium underline underline-offset-2">
                      Resolver
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
