import { createClient } from '@/lib/supabase/server'
import { ListaImoveis } from '@/components/operacional/lista-imoveis'
import type { ImovelLimpeza } from '@/lib/limpeza'

export default async function OperacionalInicio() {
  const supabase = await createClient()

  // Única janela do operacional para os imóveis: função SECURITY DEFINER que
  // devolve os quartos ativos na Amenitiz com a situação de cada um — hóspede,
  // saída, próxima entrada e última limpeza (migration 043).
  const { data, error } = await supabase.rpc('listar_imoveis_limpeza')
  const imoveis = (data ?? []) as ImovelLimpeza[]

  return (
    <div>
      <h1 className="text-xl font-bold text-[#0f1a2e]">Qual imóvel você vai limpar?</h1>
      <p className="text-sm text-[#5a6a82] mt-1 mb-4">
        Quando o hóspede sai, o imóvel aparece em <span className="font-semibold text-[#b45309]">Limpar agora</span>.
        Toque nele, marque o checklist e finalize — a AlugEasy recebe o registro.
      </p>

      {error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Não foi possível carregar os imóveis. Atualize a página ou avise o escritório.
        </div>
      ) : (
        <ListaImoveis imoveis={imoveis} />
      )}
    </div>
  )
}
