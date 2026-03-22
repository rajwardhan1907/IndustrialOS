// app/api/email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM || 'onboarding@resend.dev'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, to, data } = body

    if (!type || !to || !data) {
      return NextResponse.json({ error: 'type, to, and data are required' }, { status: 400 })
    }

    let subject = ''
    let html    = ''

    if (type === 'invoice') {
      subject = `Invoice ${data.invoiceNumber} from IndustrialOS`
      html    = invoiceEmailHTML(data)
    } else if (type === 'quote') {
      subject = `Quotation ${data.quoteNumber} from IndustrialOS`
      html    = quoteEmailHTML(data)
    } else {
      return NextResponse.json({ error: 'type must be invoice or quote' }, { status: 400 })
    }

    const result = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: result.data?.id })
  } catch (err: any) {
    console.error('Email route error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to send email' }, { status: 500 })
  }
}

// ── Invoice email HTML ────────────────────────────────────────────────────────
function invoiceEmailHTML(inv: any): string {
  const fmtMoney = (n: number) => `$${(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const fmtDate  = (d: string) => { try { return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) } catch { return d } }

  const itemRows = (Array.isArray(inv.items) ? inv.items : []).map((item: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;color:#2d2a24;">${item.desc}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;">${item.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;">${fmtMoney(item.unitPrice)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;font-weight:700;">${fmtMoney(item.total)}</td>
    </tr>
  `).join('')

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f3ef;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:#3d6fb5;padding:28px 32px;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">IndustrialOS</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">Enterprise B2B Platform</div>
      </div>

      <!-- Title bar -->
      <div style="background:#f5f3ef;padding:16px 32px;border-bottom:1px solid #e8e3da;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:20px;font-weight:800;color:#2d2a24;">INVOICE</div>
          <div style="font-size:13px;color:#3d6fb5;font-weight:700;margin-top:2px;">${inv.invoiceNumber}</div>
        </div>
        <div style="background:${inv.status==='paid'?'#edf6f1':inv.status==='overdue'?'#fdf0ee':'#fef5e7'};color:${inv.status==='paid'?'#2e7d5e':inv.status==='overdue'?'#c0392b':'#b86a00'};padding:4px 14px;border-radius:999px;font-size:11px;font-weight:800;">
          ${(inv.status||'UNPAID').toUpperCase()}
        </div>
      </div>

      <!-- Info grid -->
      <div style="padding:20px 32px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Bill To</div><div style="font-size:14px;font-weight:700;color:#2d2a24;">${inv.customer}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Due Date</div><div style="font-size:14px;font-weight:700;color:#2d2a24;">${fmtDate(inv.dueDate)}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Issue Date</div><div style="font-size:14px;color:#2d2a24;">${fmtDate(inv.issueDate)}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Payment Terms</div><div style="font-size:14px;color:#2d2a24;">${inv.paymentTerms||'Net 30'}</div></div>
      </div>

      <!-- Items table -->
      <div style="padding:0 32px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#3d6fb5;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="padding:16px 32px;text-align:right;">
        <div style="display:inline-block;min-width:200px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#7a7060;"><span>Subtotal</span><span>${fmtMoney(inv.subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#7a7060;"><span>Tax (8%)</span><span>${fmtMoney(inv.tax)}</span></div>
          ${inv.amountPaid>0?`<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#2e7d5e;"><span>Amount Paid</span><span>-${fmtMoney(inv.amountPaid)}</span></div>`:''}
          <div style="border-top:2px solid #e8e3da;margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#2e7d5e;"><span>Total Due</span><span>${fmtMoney(inv.total-(inv.amountPaid||0))}</span></div>
        </div>
      </div>

      ${inv.notes?`<div style="margin:0 32px 20px;padding:14px;background:#f5f3ef;border-radius:8px;font-size:13px;color:#7a7060;line-height:1.6;">${inv.notes}</div>`:''}

      <!-- Footer -->
      <div style="padding:20px 32px;border-top:1px solid #e8e3da;text-align:center;">
        <div style="font-size:12px;color:#a89e8e;">IndustrialOS - Enterprise B2B Platform</div>
        <div style="font-size:11px;color:#c5bdb0;margin-top:4px;">${inv.invoiceNumber} - Generated ${fmtDate(new Date().toISOString())}</div>
      </div>
    </div>
  </body>
  </html>
  `
}

// ── Quote email HTML ──────────────────────────────────────────────────────────
function quoteEmailHTML(q: any): string {
  const fmtMoney = (n: number) => `$${(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const fmtDate  = (d: string) => { try { return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) } catch { return d } }

  const itemRows = (Array.isArray(q.items) ? q.items : []).map((item: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:12px;color:#3d6fb5;font-family:monospace;">${item.sku||'-'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;color:#2d2a24;">${item.desc}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;">${item.qty?.toLocaleString()||1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;">${fmtMoney(item.unitPrice)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;color:${item.discount>0?'#2e7d5e':'#a89e8e'};">${item.discount>0?`${item.discount}% off`:'-'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e3da;font-size:13px;text-align:right;font-weight:700;">${fmtMoney(item.total)}</td>
    </tr>
  `).join('')

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f3ef;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#3d6fb5,#6b4ca0);padding:28px 32px;">
        <div style="font-size:22px;font-weight:800;color:#fff;">IndustrialOS</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">Enterprise B2B Platform</div>
      </div>

      <!-- Title -->
      <div style="padding:24px 32px 8px;">
        <div style="font-size:20px;font-weight:800;color:#2d2a24;">QUOTATION</div>
        <div style="font-size:13px;color:#3d6fb5;font-weight:700;margin-top:2px;">${q.quoteNumber}</div>
      </div>

      <!-- Info grid -->
      <div style="padding:16px 32px;background:#f5f3ef;margin:0 32px;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Prepared For</div><div style="font-size:14px;font-weight:700;color:#2d2a24;">${q.customer}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Valid Until</div><div style="font-size:14px;font-weight:700;color:#2d2a24;">${fmtDate(q.validUntil)}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Payment Terms</div><div style="font-size:14px;color:#2d2a24;">${q.paymentTerms||'Net 30'}</div></div>
        <div><div style="font-size:10px;font-weight:700;color:#a89e8e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Date</div><div style="font-size:14px;color:#2d2a24;">${fmtDate(q.createdAt||new Date().toISOString())}</div></div>
      </div>

      <!-- Items -->
      <div style="padding:20px 32px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#3d6fb5;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">SKU</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Description</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Disc</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="padding:16px 32px;text-align:right;">
        <div style="display:inline-block;min-width:200px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#7a7060;"><span>Subtotal</span><span>${fmtMoney(q.subtotal)}</span></div>
          ${q.discountAmt>0?`<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#2e7d5e;"><span>Discount</span><span>-${fmtMoney(q.discountAmt)}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:#7a7060;"><span>Tax (8%)</span><span>${fmtMoney(q.tax)}</span></div>
          <div style="border-top:2px solid #e8e3da;margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#2e7d5e;"><span>Grand Total</span><span>${fmtMoney(q.total)}</span></div>
        </div>
      </div>

      ${q.notes?`<div style="margin:0 32px 20px;padding:14px;background:#f5f3ef;border-radius:8px;font-size:13px;color:#7a7060;line-height:1.6;">${q.notes}</div>`:''}

      <!-- Footer -->
      <div style="padding:20px 32px;border-top:1px solid #e8e3da;text-align:center;">
        <div style="font-size:12px;color:#a89e8e;">IndustrialOS - Enterprise B2B Platform</div>
        <div style="font-size:11px;color:#c5bdb0;margin-top:4px;">${q.quoteNumber} - Valid until ${fmtDate(q.validUntil)}</div>
      </div>
    </div>
  </body>
  </html>
  `
}
