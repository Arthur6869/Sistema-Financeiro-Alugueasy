import { agruparPorArea, duracao, formatarDataHora, type ItemLimpeza } from '@/lib/limpeza'

export type LimpezaEmailDados = {
  imovel: string
  /** Todas as pessoas que fizeram a limpeza. */
  responsaveis: string[]
  /** Quem fez o envio pelo sistema. Só aparece se não estiver entre os responsáveis. */
  registradoPor: string
  iniciadaEm: string | null
  finalizadaEm: string
  itens: ItemLimpeza[]
  observacao: string | null
}

// Tudo que vem do usuário (nomes, observação) passa por aqui antes de entrar no HTML.
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function listarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export function assuntoEmailLimpeza(d: LimpezaEmailDados): string {
  const feitos = d.itens.filter(i => i.concluido).length
  const completa = feitos === d.itens.length
  const quem = listarNomes(d.responsaveis.map(n => n.split(' ')[0]))
  return completa
    ? `Limpeza concluída: ${d.imovel} (${quem})`
    : `Limpeza INCOMPLETA: ${d.imovel} (${quem}) ${feitos}/${d.itens.length}`
}

export function gerarHtmlEmailLimpeza(d: LimpezaEmailDados): string {
  const feitos = d.itens.filter(i => i.concluido).length
  const total = d.itens.length
  const completa = feitos === total
  const tempo = duracao(d.iniciadaEm, d.finalizadaEm)
  const registradorEhResponsavel = d.responsaveis.includes(d.registradoPor)

  const corStatus = completa ? '#15803d' : '#b45309'
  const fundoStatus = completa ? '#f0fdf4' : '#fffbeb'
  const textoStatus = completa
    ? `Checklist completo: ${feitos} de ${total} itens`
    : `Checklist incompleto: ${feitos} de ${total} itens`

  const blocos = agruparPorArea(d.itens).map(g => `
    <tr><td colspan="2" style="padding:14px 16px 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#193660">${esc(g.area)}</td></tr>
    ${g.itens.map(i => `
    <tr style="border-bottom:1px solid #f1f2f5">
      <td style="padding:8px 16px;width:28px;font-size:15px;color:${i.concluido ? '#15803d' : '#dc2626'}">${i.concluido ? '&#10003;' : '&#10007;'}</td>
      <td style="padding:8px 16px 8px 0;font-size:14px;color:${i.concluido ? '#111827' : '#991b1b'}">${esc(i.descricao)}${i.concluido ? '' : ' <strong>(não feito)</strong>'}</td>
    </tr>`).join('')}
  `).join('')

  const obs = d.observacao?.trim()
    ? `<div style="margin:20px 0 0;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
         <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px">OBSERVAÇÕES DA EQUIPE</div>
         <div style="font-size:14px;color:#111827;white-space:pre-wrap">${esc(d.observacao.trim())}</div>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Limpeza ${esc(d.imovel)}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#193660;border-radius:12px 12px 0 0;padding:20px 24px">
      <div style="color:#fff;font-size:13px;letter-spacing:.1em;font-weight:700">ALUGUEASY · OPERACIONAL</div>
      <div style="color:#fff;font-size:22px;font-weight:700;margin-top:6px">${esc(d.imovel)}</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px 24px">
      <div style="padding:12px 16px;border-radius:8px;background:${fundoStatus};color:${corStatus};font-weight:700;font-size:15px">${textoStatus}</div>
      <table style="width:100%;margin-top:16px;font-size:14px;color:#374151" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;color:#6b7280;width:140px;vertical-align:top">${d.responsaveis.length > 1 ? 'Responsáveis' : 'Responsável'}</td><td style="padding:4px 0;font-weight:600">${esc(listarNomes(d.responsaveis))}</td></tr>
        ${registradorEhResponsavel ? '' : `<tr><td style="padding:4px 0;color:#6b7280">Registrado por</td><td style="padding:4px 0">${esc(d.registradoPor)}</td></tr>`}
        <tr><td style="padding:4px 0;color:#6b7280">Início</td><td style="padding:4px 0">${formatarDataHora(d.iniciadaEm)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Finalizada</td><td style="padding:4px 0">${formatarDataHora(d.finalizadaEm)}</td></tr>
        ${tempo ? `<tr><td style="padding:4px 0;color:#6b7280">Duração</td><td style="padding:4px 0">${tempo}</td></tr>` : ''}
      </table>
      <table style="width:100%;margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse" cellpadding="0" cellspacing="0">
        ${blocos}
      </table>
      ${obs}
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Registro completo no sistema, em Limpezas.</p>
    </div>
  </div>
</body>
</html>`
}
