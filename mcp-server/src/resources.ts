import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabaseClient } from './supabase.js'

export function registerResources(server: McpServer): void {

  // ── resource 1: schema completo do banco ──────────────────────────────
  // URI: alugueasy://schema
  // Agente lê quando precisa entender a estrutura do banco antes de
  // sugerir queries ou migrations.
  server.resource(
    'schema',
    'alugueasy://schema',
    {
      description:
        'Complete AlugEasy database schema: all tables, columns, types, constraints, and RLS policies. Read this before writing any SQL or suggesting migrations.',
    },
    async () => {
      const schema = {
        project: 'rlkmljeatapayiroggrp',
        region: 'sa-east-1',
        tables: {
          profiles: {
            columns: ['id (uuid PK)', 'full_name (text)', 'role (text: admin|analista)', 'created_at', 'updated_at'],
            rls: 'SELECT: próprio usuário ou admin. UPDATE: apenas admin.',
            notes: 'role "analista" = operacional (acesso total). role "admin" = somente leitura.',
          },
          empreendimentos: {
            columns: ['id (uuid PK)', 'nome (text UNIQUE)', 'created_at'],
            rls: 'SELECT: qualquer autenticado. INSERT/UPDATE/DELETE: apenas analista.',
            known_values: ['ESSENCE', 'EASY', 'CULLINAN', 'ATHOS', 'NOBILE', 'FUSION', 'MERCURE', 'METROPOLITAN', 'RAMADA', 'BRISAS', 'VISION'],
          },
          apartamentos: {
            columns: [
              'id (uuid PK)',
              'empreendimento_id (FK)',
              'numero (text)',
              'taxa_repasse (numeric)',
              'tipo_repasse (lucro|faturamento)',
              'nome_proprietario (text)',
              'modelo_contrato (administracao|sublocacao)',
              'tipo_gestao (adm|sub)',
              'amenitiz_room_id (text)',
            ],
            rls: 'SELECT: qualquer autenticado. escrita: analista.',
            constraints: 'UNIQUE (empreendimento_id, numero)',
          },
          custos: {
            columns: [
              'id (uuid PK)',
              'apartamento_id (FK)',
              'mes (int 1-12)',
              'ano (int)',
              'categoria (text)',
              'valor (numeric)',
              'tipo_gestao (adm|sub)',
              'created_at',
              'updated_at',
            ],
            rls: 'SELECT: qualquer autenticado. escrita: analista.',
          },
          diarias: {
            columns: ['id (uuid PK)', 'apartamento_id (FK)', 'data (date)', 'valor (numeric)', 'tipo_gestao (adm|sub)', 'created_at'],
            rls: 'SELECT: qualquer autenticado. escrita: analista.',
            notes: 'data é sempre o 1º dia do mês de competência',
          },
          importacoes: {
            columns: [
              'id',
              'tipo (custos_adm|custos_sub|diarias_adm|diarias_sub)',
              'mes',
              'ano',
              'nome_arquivo',
              'status (concluido|erro)',
              'importado_por (FK auth.users)',
              'created_at',
            ],
            critical: 'status NUNCA é "sucesso". campo NUNCA é "tipo_planilha".',
          },
          amenitiz_syncs: {
            columns: [
              'id',
              'mes',
              'ano',
              'status (concluido|erro|em_andamento)',
              'total_reservas',
              'faturamento_bruto',
              'faturamento_liquido',
              'created_at',
              'updated_at',
            ],
          },
          amenitiz_reservas: {
            columns: [
              'id',
              'booking_id (UNIQUE)',
              'checkin',
              'checkout',
              'valor_bruto',
              'valor_liquido',
              'plataforma',
              'nome_hospede',
              'individual_room_number',
              'mes_competencia',
              'ano_competencia',
            ],
            notes: 'faturamento real = SUM(valor_liquido). individual_room_number → mapeia para apartamentos.numero',
          },
        },
        business_rules: {
          faturamento: 'Sempre usar amenitiz_reservas.valor_liquido, NÃO diarias.valor',
          taxas_plataforma: {
            booking_16pct: ['ESSENCE', 'METROPOLITAN', 'CULLINAN', 'BRISAS', 'MERCURE'],
            booking_13pct: ['EASY', 'ATHOS', 'NOBILE', 'FUSION', 'RAMADA', 'VISION'],
            airbnb: '0%',
            alugueasy_manual: '10%',
            mercure_1419: '13% (exceção: apt 1419)',
          },
          roles: 'analista = acesso total operacional. admin = somente leitura.',
          redirect: 'Sempre "/" para dashboard. NUNCA "/dashboard".',
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
}
