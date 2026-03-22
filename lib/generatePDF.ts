// lib/generatePDF.ts
// Client-side PDF generation using jsPDF — no server needed.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: string) => {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return d }
}

// ── Shared header ─────────────────────────────────────────────────────────────
function addHeader(doc: jsPDF, title: string, docNumber: string) {
  // Background bar
  doc.setFillColor(61, 111, 181)
  doc.rect(0, 0, 210, 22, 'F')

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('IndustrialOS', 14, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Enterprise B2B Platform', 14, 19)

  // Document type + number on right
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 196, 12, { align: 'right' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(docNumber, 196, 19, { align: 'right' })

  // Reset color
  doc.setTextColor(45, 42, 36)
}

// ── Shared footer ─────────────────────────────────────────────────────────────
function addFooter(doc: jsPDF, docNumber: string, extra: string) {
  const pageHeight = doc.internal.pageSize.height
  doc.setDrawColor(232, 227, 218)
  doc.line(14, pageHeight - 18, 196, pageHeight - 18)
  doc.setFontSize(8)
  doc.setTextColor(168, 158, 142)
  doc.text('IndustrialOS - Enterprise B2B Platform', 14, pageHeight - 12)
  doc.text(`${docNumber} - ${extra}`, 196, pageHeight - 12, { align: 'right' })
}

// ── Info grid ─────────────────────────────────────────────────────────────────
function addInfoGrid(doc: jsPDF, fields: { label: string; value: string }[], startY: number) {
  doc.setFillColor(245, 243, 239)
  doc.roundedRect(14, startY, 182, 18, 2, 2, 'F')

  const colWidth = 182 / fields.length
  fields.forEach((f, i) => {
    const x = 14 + i * colWidth + 4
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(168, 158, 142)
    doc.text(f.label.toUpperCase(), x, startY + 6)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(45, 42, 36)
    doc.text(f.value || '-', x, startY + 13)
  })

  return startY + 24
}

// ── Totals block ──────────────────────────────────────────────────────────────
function addTotals(doc: jsPDF, rows: { label: string; value: string; bold?: boolean }[], startY: number) {
  const x1 = 140
  const x2 = 196
  let y = startY + 6

  rows.forEach(row => {
    if (row.bold) {
      doc.setDrawColor(232, 227, 218)
      doc.line(x1, y - 3, x2, y - 3)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(46, 125, 94)
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(122, 112, 96)
    }
    doc.text(row.label, x1, y)
    doc.text(row.value, x2, y, { align: 'right' })
    y += 7
  })

  return y
}

// ── Generate Invoice PDF ──────────────────────────────────────────────────────
export function generateInvoicePDF(inv: any) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  addHeader(doc, 'INVOICE', inv.invoiceNumber || 'INV-XXXX')

  let y = addInfoGrid(doc, [
    { label: 'Bill To',        value: inv.customer      || '-' },
    { label: 'Issue Date',     value: fmtDate(inv.issueDate)   },
    { label: 'Due Date',       value: fmtDate(inv.dueDate)     },
    { label: 'Payment Terms',  value: inv.paymentTerms  || '-' },
    { label: 'Status',         value: (inv.status || 'unpaid').toUpperCase() },
  ], 28)

  const items = Array.isArray(inv.items) ? inv.items : []

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: items.map((item: any) => [
      item.desc      || '-',
      item.qty?.toLocaleString() || '1',
      fmtMoney(item.unitPrice),
      fmtMoney(item.total),
    ]),
    theme: 'striped',
    headStyles:  { fillColor: [61, 111, 181], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 9, textColor: [45, 42, 36] },
    alternateRowStyles: { fillColor: [250, 250, 248] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  y = addTotals(doc, [
    { label: 'Subtotal',    value: fmtMoney(inv.subtotal)   },
    { label: 'Tax (8%)',    value: fmtMoney(inv.tax)        },
    ...(inv.amountPaid > 0 ? [{ label: 'Amount Paid', value: `-${fmtMoney(inv.amountPaid)}` }] : []),
    { label: 'Total Due',   value: fmtMoney(inv.total - (inv.amountPaid || 0)), bold: true },
  ], y)

  if (inv.notes) {
    y += 6
    doc.setFillColor(245, 243, 239)
    doc.roundedRect(14, y, 182, 16, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(168, 158, 142)
    doc.text('NOTES', 18, y + 6)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(122, 112, 96)
    doc.text(inv.notes.substring(0, 120), 18, y + 12)
  }

  addFooter(doc, inv.invoiceNumber || 'INV', `Generated ${fmtDate(new Date().toISOString())}`)

  doc.save(`${inv.invoiceNumber || 'invoice'}.pdf`)
}

// ── Generate Quote PDF ────────────────────────────────────────────────────────
export function generateQuotePDF(q: any) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  addHeader(doc, 'QUOTATION', q.quoteNumber || 'QT-XXXX')

  let y = addInfoGrid(doc, [
    { label: 'Prepared For',  value: q.customer      || '-' },
    { label: 'Date',          value: fmtDate(q.createdAt || new Date().toISOString()) },
    { label: 'Valid Until',   value: fmtDate(q.validUntil) },
    { label: 'Payment Terms', value: q.paymentTerms  || 'Net 30' },
  ], 28)

  const items = Array.isArray(q.items) ? q.items : []

  autoTable(doc, {
    startY: y,
    head: [['SKU', 'Description', 'Qty', 'Unit Price', 'Disc %', 'Total']],
    body: items.map((item: any) => [
      item.sku       || '-',
      item.desc      || '-',
      item.qty?.toLocaleString() || '1',
      fmtMoney(item.unitPrice),
      item.discount > 0 ? `${item.discount}%` : '-',
      fmtMoney(item.total),
    ]),
    theme: 'striped',
    headStyles:  { fillColor: [61, 111, 181], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 9, textColor: [45, 42, 36] },
    alternateRowStyles: { fillColor: [250, 250, 248] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 70 },
      2: { cellWidth: 15, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  y = addTotals(doc, [
    { label: 'Subtotal',    value: fmtMoney(q.subtotal)   },
    ...(q.discountAmt > 0 ? [{ label: 'Discount', value: `-${fmtMoney(q.discountAmt)}` }] : []),
    { label: 'Tax (8%)',    value: fmtMoney(q.tax)        },
    { label: 'Grand Total', value: fmtMoney(q.total), bold: true },
  ], y)

  if (q.notes) {
    y += 6
    doc.setFillColor(245, 243, 239)
    doc.roundedRect(14, y, 182, 16, 2, 2, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(168, 158, 142)
    doc.text('NOTES', 18, y + 6)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(122, 112, 96)
    doc.text(q.notes.substring(0, 120), 18, y + 12)
  }

  addFooter(doc, q.quoteNumber || 'QT', `Valid until ${fmtDate(q.validUntil)}`)

  doc.save(`${q.quoteNumber || 'quote'}.pdf`)
}
