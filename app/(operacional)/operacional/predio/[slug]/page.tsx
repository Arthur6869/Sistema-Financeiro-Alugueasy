import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ListaImoveis } from '@/components/operacional/lista-imoveis'
import { slugPredio, type ImovelLimpeza } from '@/lib/limpeza'

/** Apartamentos de um prédio, por prioridade de limpeza. `slug` = slugPredio(nome). */
export default async function PredioOperacional({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('listar_imoveis_limpeza')
  const doPredio = ((data ?? []) as ImovelLimpeza[]).filter(i => slugPredio(i.empreendimento) === slug)
  if (!error && doPredio.length === 0) notFound()

  const nome = doPredio[0]?.empreendimento ?? ''

  return (
    <div>
      <Link href="/operacional" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#0f766e] mb-3">
        <ArrowLeft size={15} />
        Todos os prédios
      </Link>

      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#5a6a82]">Prédio</div>
        <h1 className="text-2xl font-bold text-[#0f1a2e]">{nome}</h1>
        <p className="text-sm text-[#5a6a82] mt-1">
          {doPredio.length} {doPredio.length === 1 ? 'apartamento' : 'apartamentos'} · ordem de prioridade
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Não foi possível carregar os imóveis. Atualize a página ou avise o escritório.
        </div>
      ) : (
        <ListaImoveis imoveis={doPredio} />
      )}
    </div>
  )
}
