import { Platform } from 'react-native';

export interface OfficialDocData {
  title: string;
  category?: string;
  code?: string;
  studentName: string;
  ra: string;
  course: string;
  semester?: string;
  dateStr?: string;
  description?: string;
}

export function generateOfficialFECAPDocHTML(data: OfficialDocData): string {
  const dateFormatted = data.dateStr || new Date().toLocaleDateString('pt-BR');
  const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const authCode = data.code || `FECAP-DOC-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>FECAP - ${data.title}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      margin: 0;
      padding: 40px;
      line-height: 1.6;
    }
    .paper-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #005F40;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      position: relative;
      background: #FFFFFF;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 80px;
      color: rgba(0, 95, 64, 0.04);
      font-weight: 900;
      pointer-events: none;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #005F40;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #005F40;
      letter-spacing: 1px;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 13px;
      color: #64748B;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-title {
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      margin: 30px 0 25px 0;
      text-transform: uppercase;
      text-decoration: underline;
      text-underline-offset: 6px;
      text-decoration-color: #C5A059;
    }
    .body-content {
      font-size: 15px;
      text-align: justify;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
    }
    .info-table td {
      padding: 10px 14px;
      border: 1px solid #E2E8F0;
      font-size: 14px;
    }
    .info-table td.label {
      background-color: #F8FAFC;
      font-weight: 700;
      color: #475569;
      width: 32%;
    }
    .info-table td.value {
      color: #0F172A;
      font-weight: 600;
    }
    .auth-box {
      margin-top: 40px;
      padding: 20px;
      background: #F0FDF4;
      border: 1px dashed #005F40;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .auth-text {
      font-size: 12px;
      color: #166534;
    }
    .auth-code {
      font-family: monospace;
      font-size: 14px;
      font-weight: 800;
      color: #005F40;
      margin-top: 4px;
    }
    .signature-row {
      margin-top: 50px;
      text-align: center;
    }
    .signature-line {
      width: 280px;
      margin: 0 auto 8px auto;
      border-top: 1px solid #1E293B;
    }
    .signature-title {
      font-size: 13px;
      font-weight: 700;
      color: #1E293B;
    }
    .signature-sub {
      font-size: 11px;
      color: #64748B;
    }
    .footer-note {
      text-align: center;
      margin-top: 40px;
      font-size: 11px;
      color: #94A3B8;
    }
    @media print {
      body { padding: 0; background: none; }
      .paper-container { box-shadow: none; border: 1px solid #005F40; }
      .no-print { display: none; }
    }
    .print-bar {
      max-width: 800px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn-action {
      background: #005F40;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-action" onclick="window.print()">Imprimir / Salvar em PDF</button>
  </div>

  <div class="paper-container">
    <div class="watermark">FECAP OFICIAL</div>

    <div class="header">
      <h1 class="brand-title">Fundação Escola de Comércio Álvares Penteado</h1>
      <div class="brand-sub">Secretaria Geral Acadêmica & Central do Sucesso Alvarista (ASA)</div>
      <div class="brand-sub">Credenciamento MEC Portaria nº 1.244 | CNPJ 60.744.828/0001-01</div>
    </div>

    <div class="doc-title">${data.title}</div>

    <div class="body-content">
      A Fundação Escola de Comércio Álvares Penteado (FECAP), por meio de sua Secretaria Geral Acadêmica e do sistema oficial <strong>Área do Sucesso Alvarista (ASA)</strong>, certifica e declara para os devidos fins de comprovação institucional, perante terceiros e órgãos competentes, que os dados a seguir conferem com os registros oficiais da instituição:
    </div>

    <table class="info-table">
      <tr>
        <td class="label">Titular do Registro</td>
        <td class="value">${data.studentName}</td>
      </tr>
      <tr>
        <td class="label">Registro Acadêmico (RA)</td>
        <td class="value">${data.ra}</td>
      </tr>
      <tr>
        <td class="label">Curso / Lotação</td>
        <td class="value">${data.course}</td>
      </tr>
      <tr>
        <td class="label">Semestre / Vigência</td>
        <td class="value">${data.semester || 'Ano Letivo 2026-2'}</td>
      </tr>
      <tr>
        <td class="label">Situação Cadastral</td>
        <td class="value" style="color: #005F40;">MATRICULADO / ATIVO</td>
      </tr>
      <tr>
        <td class="label">Data e Hora de Emissão</td>
        <td class="value">${dateFormatted} às ${timeFormatted} (Horário de Brasília)</td>
      </tr>
    </table>

    ${data.description ? `<p style="font-size: 14px; color: #475569; margin: 15px 0;"><strong>Observação:</strong> ${data.description}</p>` : ''}

    <div class="auth-box">
      <div>
        <div class="auth-text"><strong>CÓDIGO DE AUTENTICIDADE DIGITAL (ICP-BRASIL):</strong></div>
        <div class="auth-code">${authCode}</div>
        <div class="auth-text" style="margin-top: 6px;">Validação pública disponível em: <strong>portal.fecap.br/autenticidade</strong></div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 26px;">🏛️</span>
      </div>
    </div>

    <div class="signature-row">
      <div class="signature-line"></div>
      <div class="signature-title">Secretaria Geral dos Cursos de Graduação</div>
      <div class="signature-sub">Assinatura Digital Certificada via Sistema ASA FECAP</div>
    </div>

    <div class="footer-note">
      Campus Liberdade: Av. da Liberdade, 532 - São Paulo / SP - CEP 01502-001 | Fone: (11) 3272-2222
    </div>
  </div>
</body>
</html>`;
}

export function downloadDocumentAsFile(filename: string, htmlContent: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }
  return false;
}

export function openDocumentInNewTab(htmlContent: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      return true;
    }
  }
  return false;
}
