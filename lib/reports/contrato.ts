// ============================================================================
// LMS-Credit-Core: Modulo de Reportes PDF
// Archivo: lib/reports/contrato.ts
// Descripcion: Generador PDF para Contrato de Prestamo Personal
// ============================================================================

import PDFDocument from 'pdfkit';

// --- Tipos ---

export interface ContratoData {
  // Empresa
  empresaNombre: string;
  empresaDireccion: string;
  empresaTelefono: string;
  empresaRnc: string;

  // Cliente
  clienteNombre: string;
  clienteDocumento: string;
  clienteDireccion: string;
  clienteTelefono: string;

  // Prestamo
  montoOriginal: number;
  tasaAnual: number;
  frecuencia: string;
  totalCuotas: number;
  montoCuota: number;
  fechaDesembolso: string;
  fechaVencimiento: string;
  garantias: string;
}

// --- Colores ---
const COLORS = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  lightBg: '#ebf8ff',
  border: '#bee3f8',
  textDark: '#1a202c',
  textGray: '#4a5568',
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

export function generateContratoPDF(data: ContratoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'letter',
        margins: { top: 50, bottom: 50, left: 55, right: 55 },
        info: {
          Title: `Contrato de Prestamo - ${data.clienteNombre}`,
          Author: data.empresaNombre,
          Subject: 'Contrato de Prestamo Personal',
          Creator: 'LMS Credit Core',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const marginL = 55;
      const marginR = 55;
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
      doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.primary)
        .text('CONTRATO DE PRESTAMO PERSONAL', marginL, y, { width: contentWidth, align: 'center' });

      y += 25;
      doc.moveTo(marginL, y).lineTo(marginL + contentWidth, y)
        .strokeColor(COLORS.primary).lineWidth(1).stroke();
      y += 20;

      // =========================================================
      // PARTES
      // =========================================================
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary)
        .text('ENTRE LAS PARTES:', marginL, y);
      y += 18;

      const partesText = `Por una parte, ${data.empresaNombre}, con RNC ${data.empresaRnc}, domiciliada en ${data.empresaDireccion}, en lo adelante denominada "EL ACREEDOR"; y por la otra parte, ${data.clienteNombre}, portador(a) de la cedula de identidad No. ${data.clienteDocumento}, con domicilio en ${data.clienteDireccion || 'la direccion registrada'}, telefono ${data.clienteTelefono || 'N/A'}, en lo adelante denominado(a) "EL DEUDOR", han convenido lo siguiente:`;

      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textDark)
        .text(partesText, marginL, y, { width: contentWidth, align: 'justify', lineGap: 3 });

      y = doc.y + 20;

      // =========================================================
      // CLAUSULAS
      // =========================================================
      const clauses = [
        {
          title: 'CLAUSULA PRIMERA: OBJETO DEL CONTRATO',
          body: `EL ACREEDOR concede a EL DEUDOR un prestamo personal por la suma de ${formatCurrency(data.montoOriginal)}, el cual sera utilizado conforme a lo acordado entre las partes. EL DEUDOR declara haber recibido dicha suma a su entera satisfaccion.`,
        },
        {
          title: 'CLAUSULA SEGUNDA: TASA DE INTERES',
          body: `El prestamo devengara una tasa de interes del ${data.tasaAnual}% anual, calculada sobre el capital pendiente de pago. Los intereses seran calculados conforme al sistema de amortizacion frances.`,
        },
        {
          title: 'CLAUSULA TERCERA: PLAZO Y FORMA DE PAGO',
          body: `EL DEUDOR se compromete a pagar el prestamo en ${data.totalCuotas} cuotas de ${formatCurrency(data.montoCuota)} cada una, con frecuencia ${data.frecuencia.toLowerCase()}, comenzando a partir del ${data.fechaDesembolso}. La fecha de vencimiento final del prestamo es el ${data.fechaVencimiento}.`,
        },
        {
          title: 'CLAUSULA CUARTA: MORA E INCUMPLIMIENTO',
          body: `En caso de que EL DEUDOR no realice el pago de cualquier cuota en la fecha convenida, incurrira en mora de pleno derecho. Se aplicaran cargos por mora conforme a las politicas vigentes de EL ACREEDOR. El incumplimiento de tres cuotas consecutivas dara derecho a EL ACREEDOR a exigir el pago total del saldo pendiente.`,
        },
        {
          title: 'CLAUSULA QUINTA: PAGO ANTICIPADO',
          body: `EL DEUDOR podra realizar pagos anticipados, ya sean abonos a capital o liquidacion total del prestamo, sin penalidad alguna. Los abonos a capital reduciran el saldo pendiente y se recalcularan las cuotas restantes.`,
        },
        {
          title: 'CLAUSULA SEXTA: GARANTIAS',
          body: data.garantias
            ? `Como garantia del cumplimiento de las obligaciones aqui contraidas, EL DEUDOR ofrece: ${data.garantias}.`
            : `El presente prestamo se otorga bajo la garantia personal de EL DEUDOR, quien responde con la totalidad de sus bienes presentes y futuros.`,
        },
        {
          title: 'CLAUSULA SEPTIMA: JURISDICCION',
          body: `Para todos los efectos legales derivados del presente contrato, las partes se someten a la jurisdiccion de los tribunales competentes del domicilio de EL ACREEDOR, renunciando a cualquier otro fuero que pudiera corresponderles.`,
        },
        {
          title: 'CLAUSULA OCTAVA: ACEPTACION',
          body: `Ambas partes declaran haber leido y aceptado todas las clausulas contenidas en el presente contrato, firmando en dos ejemplares de un mismo tenor y a un solo efecto.`,
        },
      ];

      clauses.forEach((clause) => {
        // Check page break
        if (y + 60 > pageHeight - 80) {
          doc.addPage();
          y = 50;
        }

        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary)
          .text(clause.title, marginL, y);
        y = doc.y + 6;

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.textDark)
          .text(clause.body, marginL, y, { width: contentWidth, align: 'justify', lineGap: 3 });
        y = doc.y + 14;
      });

      // =========================================================
      // RESUMEN DEL PRESTAMO
      // =========================================================
      if (y + 100 > pageHeight - 80) {
        doc.addPage();
        y = 50;
      }

      y += 5;
      const summaryH = 75;
      doc.roundedRect(marginL, y, contentWidth, summaryH, 5).fill(COLORS.lightBg);
      doc.roundedRect(marginL, y, contentWidth, summaryH, 5)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary)
        .text('RESUMEN DEL PRESTAMO', marginL + 12, y + 10);
      doc.moveTo(marginL + 12, y + 24).lineTo(marginL + contentWidth - 12, y + 24)
        .strokeColor(COLORS.border).stroke();

      const col1X = marginL + 12;
      const col2X = marginL + contentWidth / 2 + 10;
      const lw = 95;
      const sRowY = y + 32;

      const drawField = (x: number, fy: number, label: string, value: string) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray).text(label, x, fy);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.textDark).text(value, x + lw, fy);
      };

      drawField(col1X, sRowY, 'Monto Prestamo:', formatCurrency(data.montoOriginal));
      drawField(col1X, sRowY + 15, 'Tasa Anual:', `${data.tasaAnual}%`);
      drawField(col2X, sRowY, 'Cuota:', formatCurrency(data.montoCuota));
      drawField(col2X, sRowY + 15, 'Plazo:', `${data.totalCuotas} cuotas (${data.frecuencia})`);

      y += summaryH + 35;

      // =========================================================
      // FIRMAS
      // =========================================================
      if (y + 60 > pageHeight - 60) {
        doc.addPage();
        y = 50;
      }

      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text(`Firmado en ${data.empresaDireccion}, el dia ${data.fechaDesembolso}.`, marginL, y, {
          width: contentWidth, align: 'center',
        });

      y += 30;

      const sigWidth = contentWidth / 2 - 40;

      // EL ACREEDOR
      doc.moveTo(marginL + 20, y).lineTo(marginL + 20 + sigWidth, y)
        .strokeColor(COLORS.divider).lineWidth(0.8).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text('EL ACREEDOR', marginL + 20, y + 5, { width: sigWidth, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8)
        .text(data.empresaNombre, marginL + 20, y + 16, { width: sigWidth, align: 'center' });

      // EL DEUDOR
      const sig2X = marginL + contentWidth / 2 + 20;
      doc.moveTo(sig2X, y).lineTo(sig2X + sigWidth, y)
        .strokeColor(COLORS.divider).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textGray)
        .text('EL DEUDOR', sig2X, y + 5, { width: sigWidth, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8)
        .text(data.clienteNombre, sig2X, y + 16, { width: sigWidth, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textGray)
        .text(`Cedula: ${data.clienteDocumento}`, sig2X, y + 27, { width: sigWidth, align: 'center' });

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
