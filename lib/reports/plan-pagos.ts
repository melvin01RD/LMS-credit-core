// ============================================================================
// LMS-Credit-Core: Modulo de Reportes PDF
// Archivo: lib/reports/plan-pagos.ts
// Descripcion: Generador PDF para Plan de Pagos (Tabla de Amortizacion)
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface PlanPagosData {
  // Empresa
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;

  // Cliente
  clienteNombre: string;
  clienteDocumento: string;

  // Prestamo
  montoOriginal: number;
  tasaAnual: number;
  frecuencia: string;
  frecuenciaEnum: string; // WEEKLY | BIWEEKLY | MONTHLY
  totalCuotas: number;
  montoCuota: number;
  fechaInicio: string;
  estado: string;
}

interface AmortizationRow {
  numero: number;
  fechaVencimiento: string;
  cuota: number;
  capital: number;
  interes: number;
  balance: number;
}

// --- Colores ---
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  accent: '#3182ce',
  lightBg: '#ebf8ff',
  border: '#bee3f8',
  textDark: '#1a202c',
  textGray: '#4a5568',
  danger: '#e53e3e',
  success: '#38a169',
  lightGray: '#f7fafc',
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

function getPeriodsPerYear(freq: string): number {
  switch (freq) {
    case 'WEEKLY': return 52;
    case 'BIWEEKLY': return 26;
    case 'MONTHLY': return 12;
    default: return 12;
  }
}

function addPeriod(date: Date, freq: string): Date {
  const d = new Date(date);
  switch (freq) {
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      break;
    case 'BIWEEKLY':
      d.setDate(d.getDate() + 14);
      break;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

function formatDateShort(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

function calculateAmortization(data: PlanPagosData): AmortizationRow[] {
  const periodsPerYear = getPeriodsPerYear(data.frecuenciaEnum);
  const periodicRate = (data.tasaAnual / 100) / periodsPerYear;
  const n = data.totalCuotas;
  let balance = data.montoOriginal;

  // French amortization: fixed payment
  let fixedPayment: number;
  if (periodicRate === 0) {
    fixedPayment = balance / n;
  } else {
    fixedPayment = balance * (periodicRate * Math.pow(1 + periodicRate, n)) / (Math.pow(1 + periodicRate, n) - 1);
  }

  const rows: AmortizationRow[] = [];
  let dueDate = new Date(data.fechaInicio);

  for (let i = 1; i <= n; i++) {
    dueDate = addPeriod(dueDate, data.frecuenciaEnum);
    const interest = balance * periodicRate;
    const capital = i === n ? balance : fixedPayment - interest; // last payment settles remaining
    const payment = i === n ? capital + interest : fixedPayment;
    balance = Math.max(0, balance - capital);

    rows.push({
      numero: i,
      fechaVencimiento: formatDateShort(dueDate),
      cuota: Math.round(payment * 100) / 100,
      capital: Math.round(capital * 100) / 100,
      interes: Math.round(interest * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return rows;
}

// --- Generador ---

export function generatePlanPagosPDF(data: PlanPagosData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Plan de Pagos - ${data.clienteNombre}`,
          Author: data.empresaNombre,
          Subject: 'Tabla de Amortizacion',
          Creator: 'LMS Credit Core',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // =========================================================
      // HEADER
      // =========================================================
      const headerHeight = 75;
      doc.roundedRect(margin, y, contentWidth, headerHeight, 6).fill(COLORS.primary);

      doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.white)
        .text(data.empresaNombre, margin + 15, y + 12, { width: contentWidth * 0.55 });
      doc.font('Helvetica').fontSize(8)
        .text(data.empresaDireccion, margin + 15, y + 32);
      doc.text(`Tel: ${data.empresaTelefono}  |  RNC: ${data.empresaRnc}`, margin + 15, y + 44);

      doc.font('Helvetica-Bold').fontSize(13)
        .text('PLAN DE PAGOS', margin + contentWidth * 0.55, y + 12, {
          width: contentWidth * 0.42, align: 'right',
        });
      doc.font('Helvetica').fontSize(8)
        .text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, margin + contentWidth * 0.55, y + 32, {
          width: contentWidth * 0.42, align: 'right',
        });

      y += headerHeight + 15;

      // =========================================================
      // DATOS DEL PRESTAMO
      // =========================================================
      const infoHeight = 70;
      doc.roundedRect(margin, y, contentWidth, infoHeight, 5).fill(COLORS.lightBg);
      doc.roundedRect(margin, y, contentWidth, infoHeight, 5)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      const col1X = margin + 12;
      const col2X = margin + contentWidth / 2 + 10;
      const labelW = 95;

      const drawField = (x: number, fy: number, label: string, value: string) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray).text(label, x, fy);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.textDark).text(value, x + labelW, fy);
      };

      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary)
        .text('DETALLES DEL PRESTAMO', col1X, y + 10);
      doc.moveTo(col1X, y + 24).lineTo(margin + contentWidth - 12, y + 24)
        .strokeColor(COLORS.border).stroke();

      let rowY = y + 32;
      drawField(col1X, rowY, 'Cliente:', data.clienteNombre);
      drawField(col1X, rowY + 15, 'Documento:', data.clienteDocumento);

      drawField(col2X, rowY, 'Monto:', formatCurrency(data.montoOriginal));
      drawField(col2X, rowY + 15, 'Tasa Anual:', `${data.tasaAnual}% | ${data.frecuencia} | ${data.totalCuotas} cuotas`);

      y += infoHeight + 15;

      // =========================================================
      // TABLA DE AMORTIZACION
      // =========================================================
      const rows = calculateAmortization(data);
      const tableHeaders = ['No.', 'Fecha Vencimiento', 'Cuota', 'Capital', 'Interes', 'Balance'];
      const colWidths = [35, 100, 85, 85, 80, 85];

      const thH = 24;
      doc.rect(margin, y, contentWidth, thH).fill(COLORS.primary);

      let hx = margin;
      tableHeaders.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
          .text(h, hx + 6, y + 8, { width: colWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
        hx += colWidths[i];
      });

      y += thH;

      const rowH = 18;
      let totalCuota = 0, totalCapital = 0, totalInteres = 0;

      rows.forEach((row, idx) => {
        if (y + rowH > pageHeight - 60) {
          doc.addPage();
          y = margin;

          // Re-draw table header on new page
          doc.rect(margin, y, contentWidth, thH).fill(COLORS.primary);
          let nhx = margin;
          tableHeaders.forEach((h, i) => {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
              .text(h, nhx + 6, y + 8, { width: colWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
            nhx += colWidths[i];
          });
          y += thH;
        }

        const bg = idx % 2 === 0 ? COLORS.lightGray : COLORS.white;
        doc.rect(margin, y, contentWidth, rowH).fill(bg);

        let rx = margin;
        const vals = [
          String(row.numero),
          row.fechaVencimiento,
          formatCurrency(row.cuota),
          formatCurrency(row.capital),
          formatCurrency(row.interes),
          formatCurrency(row.balance),
        ];

        vals.forEach((v, i) => {
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.textDark)
            .text(v, rx + 6, y + 5, { width: colWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
          rx += colWidths[i];
        });

        doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH)
          .strokeColor(COLORS.divider).lineWidth(0.3).stroke();

        totalCuota += row.cuota;
        totalCapital += row.capital;
        totalInteres += row.interes;

        y += rowH;
      });

      // Totals row
      if (y + 24 > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }

      doc.rect(margin, y, contentWidth, 24).fill(COLORS.primary);
      let tx = margin;
      const totals = [
        '', 'TOTALES',
        formatCurrency(totalCuota),
        formatCurrency(totalCapital),
        formatCurrency(totalInteres),
        '',
      ];
      totals.forEach((v, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
          .text(v, tx + 6, y + 8, { width: colWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
        tx += colWidths[i];
      });

      // =========================================================
      // FOOTER
      // =========================================================
      const footerY = pageHeight - margin - 10;
      doc.moveTo(margin, footerY + 5).lineTo(pageWidth - margin, footerY + 5)
        .strokeColor(COLORS.divider).lineWidth(0.5).stroke();

      doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.textGray)
        .text(
          `Documento generado por LMS Credit Core  |  ${data.empresaNombre}  |  ${getTimestamp()}`,
          margin, footerY - 5,
          { width: contentWidth, align: 'center' },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
