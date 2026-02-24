// ============================================================================
// LMS-Credit-Core: Modulo de Reportes PDF
// Archivo: lib/reports/nota-pagare.ts
// Descripcion: Generador PDF para Nota de Pagare
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface NotaPagareData {
  // Empresa
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;

  // Cliente
  clienteNombre: string;
  clienteDocumento: string;
  clienteDireccion: string;

  // Prestamo
  montoOriginal: number;
  totalFinanceCharge?: number;
  frecuencia: string;
  totalCuotas: number;
  montoCuota: number;
  fechaDesembolso: string;
  fechaVencimiento: string;
}

// --- Colores ---
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  lightBg: '#ebf8ff',
  border: '#bee3f8',
  textDark: '#1a202c',
  textGray: '#4a5568',
  divider: '#e2e8f0',
  white: '#ffffff',
} as const;

// --- Utilidades ---

function formatCurrency(amount: number): string {
  return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getTimestamp(): string {
  const now = new Date();
  return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function numberToWords(n: number): string {
  const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  if (n === 0) return 'cero';
  if (n === 100) return 'cien';

  const intPart = Math.floor(n);
  const parts: string[] = [];

  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000);
    parts.push(millions === 1 ? 'un millon' : `${numberToWords(millions)} millones`);
  }

  const remainder = intPart % 1000000;
  if (remainder >= 1000) {
    const thousands = Math.floor(remainder / 1000);
    parts.push(thousands === 1 ? 'mil' : `${numberToWords(thousands)} mil`);
  }

  const lastThree = remainder % 1000;
  if (lastThree >= 100) {
    parts.push(hundreds[Math.floor(lastThree / 100)]);
  }

  const lastTwo = lastThree % 100;
  if (lastTwo >= 10 && lastTwo < 20) {
    parts.push(teens[lastTwo - 10]);
  } else {
    if (lastTwo >= 20) {
      const t = tens[Math.floor(lastTwo / 10)];
      const u = units[lastTwo % 10];
      parts.push(u ? `${t} y ${u}` : t);
    } else if (lastTwo > 0) {
      parts.push(units[lastTwo]);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// --- Generador ---

export function generateNotaPagarePDF(data: NotaPagareData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        info: {
          Title: `Nota de Pagare - ${data.clienteNombre}`,
          Author: data.empresaNombre,
          Subject: 'Nota de Pagare',
          Creator: 'LMS Credit Core',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginL = 60;
      const marginR = 60;
      const contentWidth = pageWidth - marginL - marginR;
      let y = 50;

      // =========================================================
      // HEADER
      // =========================================================
      const headerHeight = 60;
      doc.roundedRect(marginL, y, contentWidth, headerHeight, 6).fill(COLORS.primary);

      doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.white)
        .text(data.empresaNombre, marginL + 15, y + 12, { width: contentWidth - 30 });
      doc.font('Helvetica').fontSize(8)
        .text(`${data.empresaDireccion}  |  Tel: ${data.empresaTelefono}  |  RNC: ${data.empresaRnc}`, marginL + 15, y + 32, { width: contentWidth - 30 });

      y += headerHeight + 25;

      // =========================================================
      // TITULO
      // =========================================================
      doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.primary)
        .text('NOTA DE PAGARE', marginL, y, { width: contentWidth, align: 'center' });

      y += 30;

      doc.moveTo(marginL, y).lineTo(marginL + contentWidth, y)
        .strokeColor(COLORS.primary).lineWidth(1).stroke();

      y += 15;

      // =========================================================
      // MONTO Y FECHA
      // =========================================================
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.textDark)
        .text(`Monto: ${formatCurrency(data.montoOriginal)}`, marginL, y);
      doc.text(`Fecha: ${data.fechaDesembolso}`, marginL, y, { width: contentWidth, align: 'right' });

      y += 25;

      // =========================================================
      // CUERPO LEGAL
      // =========================================================
      const montoLetras = numberToWords(Math.floor(data.montoOriginal)).toUpperCase();

      const paragraph1 = `Yo, ${data.clienteNombre}, portador(a) de la cedula de identidad No. ${data.clienteDocumento}, con domicilio en ${data.clienteDireccion || 'la direccion registrada'}, por medio del presente documento me comprometo a pagar de forma incondicional a la orden de ${data.empresaNombre}, la suma de ${formatCurrency(data.montoOriginal)} (${montoLetras} PESOS DOMINICANOS), valor recibido a mi entera satisfaccion.`;

      doc.font('Helvetica').fontSize(10).fillColor(COLORS.textDark)
        .text(paragraph1, marginL, y, {
          width: contentWidth, align: 'justify', lineGap: 4,
        });

      y = doc.y + 18;

      // =========================================================
      // CONDICIONES DE PAGO
      // =========================================================
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
        .text('CONDICIONES DE PAGO:', marginL, y);

      y += 18;

      const conditions = [
        `El presente pagare sera pagado en ${data.totalCuotas} cuotas de ${formatCurrency(data.montoCuota)} cada una, con frecuencia ${data.frecuencia.toLowerCase()}.`,
        `El cargo financiero fijo aplicable es de ${formatCurrency(data.totalFinanceCharge ?? 0)}, distribuido proporcionalmente en las cuotas.`,
        `La fecha del primer pago sera conforme al calendario de pagos establecido a partir del ${data.fechaDesembolso}.`,
        `La fecha de vencimiento final del presente pagare es el ${data.fechaVencimiento}.`,
      ];

      conditions.forEach((c) => {
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textDark)
          .text(`    ${c}`, marginL, y, { width: contentWidth, lineGap: 3 });
        y = doc.y + 8;
      });

      y += 5;

      // =========================================================
      // CLAUSULA DE MORA
      // =========================================================
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
        .text('CLAUSULA DE MORA:', marginL, y);

      y += 18;

      const moraText = `En caso de incumplimiento en el pago de cualquiera de las cuotas en la fecha convenida, el deudor incurrira en mora de pleno derecho, sin necesidad de requerimiento alguno, y se aplicaran los cargos por mora establecidos en el contrato de prestamo correspondiente.`;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textDark)
        .text(moraText, marginL, y, { width: contentWidth, align: 'justify', lineGap: 3 });

      y = doc.y + 20;

      // =========================================================
      // CLAUSULA LEGAL
      // =========================================================
      const legalText = `El presente pagare se rige por las disposiciones del Codigo de Comercio de la Republica Dominicana y demas leyes aplicables. En caso de litigio, las partes se someten a la jurisdiccion de los tribunales competentes del domicilio del acreedor.`;

      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.textGray)
        .text(legalText, marginL, y, { width: contentWidth, align: 'justify', lineGap: 3 });

      y = doc.y + 40;

      // =========================================================
      // FIRMAS
      // =========================================================
      const sigWidth = contentWidth / 2 - 40;

      // Firma deudor
      doc.moveTo(marginL + 20, y).lineTo(marginL + 20 + sigWidth, y)
        .strokeColor(COLORS.divider).lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text('Firma del Deudor', marginL + 20, y + 5, { width: sigWidth, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8)
        .text(data.clienteNombre, marginL + 20, y + 16, { width: sigWidth, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text(`Cedula: ${data.clienteDocumento}`, marginL + 20, y + 27, { width: sigWidth, align: 'center' });

      // Firma acreedor
      const sig2X = marginL + contentWidth / 2 + 20;
      doc.moveTo(sig2X, y).lineTo(sig2X + sigWidth, y)
        .strokeColor(COLORS.divider).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text('Firma del Acreedor', sig2X, y + 5, { width: sigWidth, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8)
        .text(data.empresaNombre, sig2X, y + 16, { width: sigWidth, align: 'center' });

      // =========================================================
      // FOOTER
      // =========================================================
      const footerY = pageHeight - 50 - 10;
      doc.moveTo(marginL, footerY + 5).lineTo(pageWidth - marginR, footerY + 5)
        .strokeColor(COLORS.divider).lineWidth(0.5).stroke();

      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.textGray)
        .text(
          `Documento generado por LMS Credit Core  |  ${data.empresaNombre}  |  ${getTimestamp()}`,
          marginL, footerY - 5,
          { width: contentWidth, align: 'center' },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
