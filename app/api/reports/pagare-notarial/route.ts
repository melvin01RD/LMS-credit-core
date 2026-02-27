// ============================================================================
// LMS-Credit-Core: API Route para Pagaré Notarial
// Archivo: app/api/reports/pagare-notarial/route.ts
//
// Uso:
//   POST /api/reports/pagare-notarial
//   Body: PagareNotarialData
//   Response: PDF buffer
// ============================================================================

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-middleware';
import { generatePagareNotarialPDF, PagareNotarialData } from '@/lib/reports/pagare-notarial';

export const POST = withAuth(async (req) => {
  try {
    const body: PagareNotarialData = await req.json();

    if (!body.numeroActo || !body.deudorNombre || !body.deudorCedula) {
      return NextResponse.json(
        { error: { code: 'MISSING_FIELDS', message: 'Faltan campos requeridos en el cuerpo de la solicitud' } },
        { status: 400 }
      );
    }

    const buffer = await generatePagareNotarialPDF(body);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pagare-notarial-${body.numeroActo}.pdf"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[pagare-notarial] Error al generar PDF:', error);
    return NextResponse.json(
      { error: { code: 'GENERATION_ERROR', message: 'Error al generar el pagaré notarial' } },
      { status: 500 }
    );
  }
});
