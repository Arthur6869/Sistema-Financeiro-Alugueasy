export type ApartamentoEmailDados = {
  empreendimento: string
  numero: string
  faturamento: number
  custos: number
  lucro: number
  repasse: number
  valorLiquido: number
  tipoGestao: string
}

export type ExtratoEmailDados = {
  nomeProprietario: string
  mes: string
  ano: number
  apartamentos: ApartamentoEmailDados[]
  totalFaturamento: number
  totalLucro: number
  totalRepasse: number
  totalLiquido: number
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function gerarHtmlEmail(dados: ExtratoEmailDados): string {
  const linhasApts = dados.apartamentos.map(a => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:12px 16px;font-weight:500;color:#111827">
        ${a.empreendimento} — Apt ${a.numero}
        <span style="font-size:11px;background:#f3f4f6;color:#6b7280;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:400">
          ${a.tipoGestao.toUpperCase()}
        </span>
      </td>
      <td style="padding:12px 16px;text-align:right;color:#193660;font-weight:500">${fmt(a.faturamento)}</td>
      <td style="padding:12px 16px;text-align:right;color:#ef4444">${fmt(a.custos)}</td>
      <td style="padding:12px 16px;text-align:right;color:${a.lucro >= 0 ? '#16a34a' : '#ef4444'}">${fmt(a.lucro)}</td>
      <td style="padding:12px 16px;text-align:right;color:#d97706;font-weight:600">${fmt(a.valorLiquido)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Extrato ${dados.mes}/${dados.ano} — AlugEasy</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:640px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <!-- Header -->
    <div style="background:#193660;padding:32px 40px">
      <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-.5px">AlugEasy</div>
      <div style="font-size:13px;color:#93c5fd;margin-top:4px">Portal do Proprietário</div>
    </div>

    <!-- Saudação -->
    <div style="padding:32px 40px 0">
      <h2 style="margin:0 0 6px;color:#111827;font-size:20px;font-weight:600">
        Olá, ${dados.nomeProprietario}!
      </h2>
      <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">
        Aqui está o extrato dos seus imóveis referente a
        <strong style="color:#374151">${dados.mes} de ${dados.ano}</strong>.
      </p>
    </div>

    <!-- KPIs -->
    <div style="padding:24px 40px;display:flex;gap:12px">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:6px;font-weight:600">Faturamento</div>
        <div style="font-size:18px;font-weight:700;color:#193660">${fmt(dados.totalFaturamento)}</div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:6px;font-weight:600">Lucro</div>
        <div style="font-size:18px;font-weight:700;color:${dados.totalLucro >= 0 ? '#16a34a' : '#ef4444'}">${fmt(dados.totalLucro)}</div>
      </div>
      <div style="flex:1;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#92400e;margin-bottom:6px;font-weight:600">Seu Valor</div>
        <div style="font-size:18px;font-weight:700;color:#d97706">${fmt(dados.totalLiquido)}</div>
      </div>
    </div>

    <!-- Tabela de apartamentos -->
    <div style="padding:0 40px 24px">
      <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
        Detalhamento por imóvel
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 16px;text-align:left;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Imóvel</th>
              <th style="padding:10px 16px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Faturamento</th>
              <th style="padding:10px 16px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Custos</th>
              <th style="padding:10px 16px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Lucro</th>
              <th style="padding:10px 16px;text-align:right;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Seu Valor</th>
            </tr>
          </thead>
          <tbody>${linhasApts}</tbody>
        </table>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:0 40px 32px;text-align:center">
      <a href="https://alugueasy.com.br/proprietario/extrato?mes=${dados.mes}&ano=${dados.ano}"
         style="display:inline-block;background:#193660;color:#ffffff;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
        Ver extrato completo →
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#9ca3af">
        Acesse também seu histórico dos últimos 12 meses no portal
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
        AlugEasy © ${dados.ano} — Este email foi gerado automaticamente.<br>
        Dúvidas? Entre em contato com sua equipe AlugEasy.
      </p>
    </div>
  </div>
</body>
</html>`
}
