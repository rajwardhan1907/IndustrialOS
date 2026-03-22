import { NextRequest, NextResponse } from 'next/server'
import ReactPDF from '@react-pdf/renderer'
import { InvoicePDF, QuotePDF } from '@/lib/pdfTemplates'
import React from 'react'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json({ error: 'type and data are required' }, { status: 400 })
    }

    let element: React.ReactElement

    if (type === 'invoice') {
      element = React.createElement(InvoicePDF, { data })
    } else if (type === 'quote') {
      element = React.createElement(QuotePDF, { data })
    } else {
      return NextResponse.json({ error: 'type must be invoice or quote' }, { status: 400 })
    }

    const buffer = await ReactPDF.renderToBuffer(element)
    const uint8  = new Uint8Array(buffer)

    const filename = type === 'invoice'
      ? `${data.invoiceNumber || 'invoice'}.pdf`
      : `${data.quoteNumber   || 'quote'}.pdf`

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    console.error('PDF generation error:', err?.message || err)
    return NextResponse.json(
      { error: 'Failed to generate PDF', detail: err?.message || 'unknown' },
      { status: 500 }
    )
  }
}
