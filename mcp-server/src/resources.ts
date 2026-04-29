import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabaseClient } from './supabase.js'

export function registerResources(server: McpServer): void {

  // ── resource 1: schema híbrido (estático + dinâmico) ─────────────────
  // URI: alugueasy://schema
  // Retorna colunas reais do banco via information_schema +
  // regras de negócio estáticas que não mudam sem código.
  server.resource(
    'schema',
    'alugueasy://schema',
    {
      description:
        'Complete AlugEasy database schema: live table columns from information_schema + static business rules and constraints. Read this before writing any SQL or suggesting migrations.',
    },
    async () => {
      const supabase = getSupabaseClient()

      // query dinâmica: busca tabelas e colunas reais do Supabase
      const { data: tableData } = await (supabase as any)
        .rpc('exec_sql', {
          sql: `
            SELECT
              t.table_name,
              json_agg(
                json_build_object(
                  'column', c.column_name,
                  'type', c.data_type,
                  'nullable', c.is_nullable,
                  'default', c.column_default
                ) ORDER BY c.ordinal_position
              ) AS columns
            FROM information_schema.tables t
            JOIN information_schema.columns c
              ON c.table_name = t.table_name
              AND c.table_schema = t.table_schema
            WHERE t.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
            GROUP BY t.table_name
            ORDER BY t.table_name
          `,
        })
        .catch(() => ({ data: null }))

      // regras de negócio estáticas (não mudam sem código)
      const business_rules = {
        faturamento: 'Sempre usar amenitiz_reservas.valor_liquido, NÃO diarias.valor',
        roles: '"analista" = acesso total operacional. "admin" = somente leitura.',
        redirect: 'Sempre "/" para dashboard. NUNCA "/dashboard".',
        status_importacoes: '"concluido" ou "erro". NUNCA "sucesso".',
        tipo_importacoes: 'custos_adm | custos_sub | diarias_adm | diarias_sub. NUNCA "tipo_planilha".',
        taxas_plataforma: {
          booking_16pct: ['ESSENCE', 'METROPOLITAN', 'CULLINAN', 'BRISAS', 'MERCURE'],
          booking_13pct: ['EASY', 'ATHOS', 'NOBILE', 'FUSION', 'RAMADA', 'VISION'],
          mercure_1419_excecao: '13% (não 16%)',
          airbnb: '0%',
          alugueasy_manual: '10%',
        },
      }

      const schema = {
        project: 'rlkmljeatapayiroggrp',
        region: 'sa-east-1',
        generated_at: new Date().toISOString(),
        live_tables: tableData ?? 'unavailable — use static schema below',
        business_rules,
        critical_constraints: {
          importacoes_status: ['concluido', 'erro'],
          importacoes_tipo: ['custos_adm', 'custos_sub', 'diarias_adm', 'diarias_sub'],
          tipo_gestao: ['adm', 'sub'],
          tipo_repasse: ['lucro', 'faturamento'],
          modelo_contrato: ['administracao', 'sublocacao'],
          profiles_role: ['admin', 'analista'],
        },
      }

      return {
        contents: [
          {
            uri: 'alugueasy://schema',
            mimeType: 'application/json',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      }
    }
  )

  // ── resource 2: empreendimentos vivos ─────────────────────────────────
  // URI: alugueasy://empreendimentos
  // Agente lê antes de qualquer operação que referencie empreendimento.
  server.resource(
    'empreendimentos',
    'alugueasy://empreendimentos',
    {
      description:
        'Live list of all empreendimentos (properties) and their apartments from the database. Read this to know which properties exist before filtering or reporting.',
    },
    async () => {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, apartamentos(id, numero, tipo_gestao, amenitiz_room_id)')
        .order('nome')

      if (error) throw new Error(`Resource empreendimentos error: ${error.message}`)

      return {
        contents: [
          {
            uri: 'alugueasy://empreendimentos',
            mimeType: 'application/json',
            text: JSON.stringify({ total: data?.length ?? 0, empreendimentos: data }, null, 2),
          },
        ],
      }
    }
  )

  // ── resource 3: config de taxas ───────────────────────────────────────
  // URI: alugueasy://config/taxas
  // Agente consulta antes de calcular valor líquido de reservas.
  server.resource(
    'config-taxas',
    'alugueasy://config/taxas',
    {
      description:
        'Platform fee configuration per property. Use this before calculating net revenue from Amenitiz reservations.',
    },
    async () => {
      const config = {
        booking_com: {
          taxa_16pct: ['ESSENCE', 'METROPOLITAN', 'CULLINAN', 'BRISAS', 'MERCURE'],
          taxa_13pct: ['EASY', 'ATHOS', 'NOBILE', 'FUSION', 'RAMADA', 'VISION'],
          excecao_13pct: 'MERCURE apartamento 1419',
        },
        airbnb: { taxa: 0, nota: 'Airbnb cobra do hóspede, não do anfitrião' },
        alugueasy_direto: { taxa: 10, nota: 'Reservas manuais via plataforma própria' },
        formula: 'valor_liquido = valor_bruto * (1 - taxa / 100)',
      }

      return {
        contents: [
          {
            uri: 'alugueasy://config/taxas',
            mimeType: 'application/json',
            text: JSON.stringify(config, null, 2),
          },
        ],
      }
    }
  )

  // ── resource 4: apartamentos sem amenitiz_room_id ─────────────────────
  // URI: alugueasy://diagnostico/sem-room-id
  // Agente verifica antes de qualquer sync para detectar cobertura parcial.
  server.resource(
    'apartamentos-sem-room-id',
    'alugueasy://diagnostico/sem-room-id',
    {
      description:
        'Lists apartments missing amenitiz_room_id mapping. These apartments will be invisible to the Amenitiz sync and their reservations will be lost. Run this before any sync to detect gaps.',
    },
    async () => {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('apartamentos')
        .select('id, numero, tipo_gestao, empreendimentos(nome)')
        .is('amenitiz_room_id', null)
        .order('empreendimento_id')

      if (error) throw new Error(`Resource sem-room-id error: ${error.message}`)

      const total = data?.length ?? 0
      const impacto =
        total > 0
          ? `⚠️ ${total} apartamento(s) sem mapeamento — reservas Amenitiz serão IGNORADAS no sync.`
          : '✅ Todos os apartamentos têm amenitiz_room_id configurado.'

      return {
        contents: [
          {
            uri: 'alugueasy://diagnostico/sem-room-id',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                total_sem_room_id: total,
                impacto,
                apartamentos:
                  data?.map((a) => ({
                    id: a.id,
                    numero: a.numero,
                    empreendimento: (a.empreendimentos as any)?.nome ?? '—',
                    tipo_gestao: a.tipo_gestao,
                    acao_necessaria: `UPDATE apartamentos SET amenitiz_room_id = '<UUID_AMENITIZ>' WHERE id = '${a.id}'`,
                  })) ?? [],
                instrucao:
                  'Para corrigir: obter o UUID do quarto na API Amenitiz e executar a migration 007_brisas_room_ids.sql',
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
