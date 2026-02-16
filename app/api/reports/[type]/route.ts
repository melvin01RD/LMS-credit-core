// ============================================================================
// LMS-Credit-Core: API Route para Reportes PDF
// Archivo: app/api/reports/[type]/route.ts
//
// Uso:
//   GET /api/reports/recibo-pago?paymentId=xxx
//   GET /api/reports/estado-cuenta?loanId=xxx
//   GET /api/reports/plan-pagos?loanId=xxx
//   GET /api/reports/nota-pagare?loanId=xxx
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generatePdfReport, PdfReportType } from '@/lib/services/pdf-report.service';
import { ServiceError } from '@/lib/errors';

const REPORT_CONFIG: Record<PdfReportType, { paramName: string; fileName: string }> = {
  'recibo-pago': {
    paramName: 'paymentId',
    fileName: 'Recibo_de_Pago',
  },
  'estado-cuenta': {
    paramName: 'loanId',
    fileName: 'Estado_de_Cuenta',
  },
  'plan-pagos': {
    paramName: 'loanId',
    fileName: 'Plan_de_Pagos',
  },
  'nota-pagare': {
    paramName: 'loanId',
    fileName: 'Nota_de_Pagare',
  },
  'contrato': {
    paramName: 'loanId',
    fileName: 'Contrato_Prestamo',
  },
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const params = await context.params;
    const reportType = params.type as PdfReportType;

    // Validar tipo de reporte
    const config = REPORT_CONFIG[reportType];
    if (!config) {
      return NextResponse.json(
        { error: { code: 'INVALID_REPORT_TYPE', message: `Tipo de reporte no válido: ${reportType}` } },
        { status: 400 }
      );
    }

    // Obtener el ID de la entidad
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get(config.paramName);

    if (!entityId) {
      return NextResponse.json(
        { error: { code: 'MISSING_PARAMETER', message: `Parámetro requerido: ${config.paramName}` } },
        { status: 400 }
      );
    }

    // Generar el PDF
    const pdfBuffer = await generatePdfReport(reportType, entityId);

    // Construir nombre del archivo
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${config.fileName}_${timestamp}.pdf`;

    // Retornar el PDF como respuesta
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error(`Error generando reporte:`, error);

    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Error interno al generar el reporte' } },
      { status: 500 }
    );
  }
}
