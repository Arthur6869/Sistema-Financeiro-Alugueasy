import { createClient } from '@/lib/supabase/server'
import { ListaPredios } from '@/components/operacional/lista-predios'
import type { ImovelLimpeza } from '@/lib/limpeza'

export default async function OperacionalInicio() {
  const supabase = await createClient()

  // Única janela do operacional para os imóveis: função SECURITY DEFINER que
  // devolve os quartos ativos na Amenitiz com a situação de cada um — hóspede,
  // saída, próxima entrada e última limpeza (migration 043). A tela inicial
  // resume por prédio; os apartamentos aparecem dentro do prédio escolhido.
  const { data, error } = await supabase.rpc('listar_imoveis_limpeza')
  const imoveis = (data ?? []) as ImovelLimpeza[]

  return (
    <div>
      <h1 className="text-xl font-bold text-[#0f1a2e]">Em qual prédio você está?</h1>
      <p className="text-sm text-[#5a6a82] mt-1 mb-4">
        Toque no prédio para ver os apartamentos dele na ordem em que precisam de limpeza.
      </p>

      {error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Não foi possível carregar os imóveis. Atualize a página ou avise o escritório.
        </div>
      ) : (
        <ListaPredios imoveis={imoveis} />
      )}
    </div>
  )
}
