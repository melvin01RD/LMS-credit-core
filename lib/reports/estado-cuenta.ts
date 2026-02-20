// ============================================================================
// LMS-Credit-Core: Modulo de Reportes PDF
// Archivo: lib/reports/estado-cuenta.ts
// Descripcion: Generador PDF para Estado de Cuenta
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface PaymentRecord {
  fecha: string;
  monto: number;
  capital: number;
  interes: number;
  mora: number;
  balance: number;
  registradoPor: string;
}

export interface EstadoCuentaData {
  // Empresa
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;

  // Cliente
  clienteNombre: string;
  clienteDocumento: string;
  clienteTelefono: string;
  clienteDireccion: string;

  // Prestamo
  prestamoId: string;
  montoOriginal: number;
  tasaAnual?: number;               // solo FRENCH_AMORTIZATION
  totalFinanceCharge?: number;      // solo FLAT_RATE
  loanStructure?: string;           // 'FRENCH_AMORTIZATION' | 'FLAT_RATE'
  frecuencia: string;
  totalCuotas: number;
  montoCuota: number;
  fechaDesembolso: string;
  estado: string;

  // Saldos
  capitalPagado: number;
  interesPagado: number;
  moraPagada: number;
  capitalPendiente: number;

  // Historial
  pagos: PaymentRecord[];
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

// --- Generador ---

export function generateEstadoCuentaPDF(data: EstadoCuentaData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
          Title: `Estado de Cuenta - ${data.clienteNombre}`,
          Author: data.empresaNombre,
          Subject: 'Estado de Cuenta',
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
        .text('ESTADO DE CUENTA', margin + contentWidth * 0.55, y + 12, {
          width: contentWidth * 0.42, align: 'right',
        });
      doc.font('Helvetica').fontSize(8)
        .text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, margin + contentWidth * 0.55, y + 32, {
          width: contentWidth * 0.42, align: 'right',
        });

      y += headerHeight + 15;

      // =========================================================
      // DATOS DEL CLIENTE Y PRESTAMO
      // =========================================================
      const infoHeight = 100;
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
        .text('DATOS DEL CLIENTE Y PRESTAMO', col1X, y + 10);
      doc.moveTo(col1X, y + 24).lineTo(margin + contentWidth - 12, y + 24)
        .strokeColor(COLORS.border).stroke();

      let rowY = y + 32;
      drawField(col1X, rowY, 'Cliente:', data.clienteNombre);
      drawField(col1X, rowY + 15, 'Documento:', data.clienteDocumento);
      drawField(col1X, rowY + 30, 'Direccion:', data.clienteDireccion || 'N/A');
      drawField(col1X, rowY + 45, 'Telefono:', data.clienteTelefono || 'N/A');

      const isFlat = data.loanStructure === 'FLAT_RATE';
      drawField(col2X, rowY, 'Monto Original:', formatCurrency(data.montoOriginal));
      drawField(
        col2X, rowY + 15,
        isFlat ? 'Cargo Financiero:' : 'Tasa Anual:',
        isFlat ? formatCurrency(data.totalFinanceCharge ?? 0) : `${data.tasaAnual ?? 0}%`
      );
      drawField(col2X, rowY + 30, 'Frecuencia:', data.frecuencia);
      drawField(col2X, rowY + 45, 'Cuotas:', `${data.totalCuotas} x ${formatCurrency(data.montoCuota)}`);

      y += infoHeight + 15;

      // =========================================================
      // RESUMEN DE SALDOS
      // =========================================================
      const totalPagado = data.capitalPagado + data.interesPagado + data.moraPagada;
      const progreso = data.montoOriginal > 0
        ? Math.min(100, Math.round((data.capitalPagado / data.montoOriginal) * 100))
        : 0;

      const summaryHeight = 55;
      doc.roundedRect(margin, y, contentWidth, summaryHeight, 5).fill(COLORS.primary);

      const colW = contentWidth / 4;
      const summaryItems = [
        { label: 'Capital Pagado', value: formatCurrency(data.capitalPagado) },
        { label: 'Interes Pagado', value: formatCurrency(data.interesPagado) },
        { label: 'Total Pagado', value: formatCurrency(totalPagado) },
        { label: 'Capital Pendiente', value: formatCurrency(data.capitalPendiente) },
      ];

      summaryItems.forEach((item, i) => {
        const sx = margin + colW * i + 12;
        doc.font('Helvetica').fontSize(7).fillColor('#a0c4e8').text(item.label, sx, y + 10);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.white).text(item.value, sx, y + 24);
      });

      // Progress bar
      doc.font('Helvetica').fontSize(7).fillColor('#a0c4e8')
        .text(`Progreso: ${progreso}%`, margin + 12, y + 42);
      const barX = margin + 90;
      const barW = contentWidth - 102;
      doc.roundedRect(barX, y + 42, barW, 6, 3).fill('#2c5282');
      if (progreso > 0) {
        doc.roundedRect(barX, y + 42, barW * (progreso / 100), 6, 3).fill(COLORS.success);
      }

      y += summaryHeight + 15;

      // =========================================================
      // TABLA DE PAGOS
      // =========================================================
      const tableHeaders = ['#', 'Fecha', 'Monto', 'Capital', 'Interes', 'Mora', 'Balance'];
      const colWidths = [30, 80, 85, 85, 75, 65, 85];

      // Table header
      const thH = 24;
      doc.rect(margin, y, contentWidth, thH).fill(COLORS.primary);

      let hx = margin;
      tableHeaders.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white)
          .text(h, hx + 6, y + 8, { width: colWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
        hx += colWidths[i];
      });

      y += thH;

      // Table rows
      const rowH = 20;
      data.pagos.forEach((pago, idx) => {
        // Check if we need a new page
        if (y + rowH > pageHeight - 60) {
          doc.addPage();
          y = margin;
        }

        const bg = idx % 2 === 0 ? COLORS.lightGray : COLORS.white;
        doc.rect(margin, y, contentWidth, rowH).fill(bg);

        let rx = margin;
        const vals = [
          String(idx + 1),
          pago.fecha,
          formatCurrency(pago.monto),
          formatCurrency(pago.capital),
          formatCurrency(pago.interes),
          formatCurrency(pago.mora),
          formatCurrency(pago.balance),
        ];

        vals.forEach((v, i) => {
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.textDark)
            .text(v, rx + 6, y + 6, { width: colWidths[i] - 12, align: i >= 2 ? 'right' : 'left' });
          rx += colWidths[i];
        });

        doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH)
          .strokeColor(COLORS.divider).lineWidth(0.3).stroke();

        y += rowH;
      });

      if (data.pagos.length === 0) {
        doc.rect(margin, y, contentWidth, 30).fill(COLORS.lightGray);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.textGray)
          .text('No hay pagos registrados', margin, y + 10, { width: contentWidth, align: 'center' });
        y += 30;
      }

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
