// lib/pdfTemplates.tsx
// React PDF templates for Invoice and Quote documents.
// Used by app/api/pdf/route.ts

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        10,
    color:           '#2d2a24',
    backgroundColor: '#ffffff',
    padding:         40,
  },
  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   32,
  },
  logo: {
    fontSize:   22,
    fontFamily: 'Helvetica-Bold',
    color:      '#3d6fb5',
  },
  logoSub: {
    fontSize: 9,
    color:    '#a89e8e',
    marginTop: 2,
  },
  docTitle: {
    fontSize:   20,
    fontFamily: 'Helvetica-Bold',
    color:      '#2d2a24',
    textAlign:  'right',
  },
  docNumber: {
    fontSize:  10,
    color:     '#3d6fb5',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
  // Info grid
  infoGrid: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    marginBottom:    28,
    backgroundColor: '#f5f3ef',
    padding:         14,
    borderRadius:    6,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize:   8,
    color:      '#a89e8e',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 10,
    color:    '#2d2a24',
    fontFamily: 'Helvetica-Bold',
  },
  // Table
  tableHeader: {
    flexDirection:   'row',
    backgroundColor: '#e8e3da',
    padding:         '8 10',
    borderRadius:    4,
    marginBottom:    4,
  },
  tableRow: {
    flexDirection:  'row',
    padding:        '8 10',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e3da',
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: '#fafaf8',
  },
  colDesc: { flex: 3, fontSize: 9 },
  colQty:  { flex: 1, fontSize: 9, textAlign: 'right' },
  colPrice:{ flex: 1.2, fontSize: 9, textAlign: 'right' },
  colDisc: { flex: 1, fontSize: 9, textAlign: 'right' },
  colTotal:{ flex: 1.2, fontSize: 9, textAlign: 'right' },
  colHeaderText: {
    fontSize:   8,
    fontFamily: 'Helvetica-Bold',
    color:      '#7a7060',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Totals
  totalsBox: {
    marginTop:       16,
    alignSelf:       'flex-end',
    width:           200,
  },
  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   5,
  },
  totalLabel: { fontSize: 9, color: '#7a7060' },
  totalValue: { fontSize: 9, color: '#2d2a24', fontFamily: 'Helvetica-Bold' },
  grandLabel: { fontSize: 11, color: '#2d2a24', fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 11, color: '#2e7d5e', fontFamily: 'Helvetica-Bold' },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#e8e3da',
    borderTopStyle: 'solid',
    marginVertical: 6,
  },
  // Notes
  notesBox: {
    marginTop:       24,
    padding:         12,
    backgroundColor: '#f5f3ef',
    borderRadius:    6,
  },
  notesLabel: {
    fontSize:   8,
    fontFamily: 'Helvetica-Bold',
    color:      '#a89e8e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  notesText: {
    fontSize:   9,
    color:      '#7a7060',
    lineHeight: 1.5,
  },
  // Status badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      4,
    alignSelf:         'flex-end',
    marginTop:         4,
  },
  badgeText: {
    fontSize:   8,
    fontFamily: 'Helvetica-Bold',
  },
  // Footer
  footer: {
    position:   'absolute',
    bottom:     24,
    left:       40,
    right:      40,
    borderTopWidth: 1,
    borderTopColor: '#e8e3da',
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color:    '#a89e8e',
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: string) => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return d }
}

// ── Invoice PDF ───────────────────────────────────────────────────────────────
export function InvoicePDF({ data }: { data: any }) {
  const items   = Array.isArray(data.items) ? data.items : []
  const statusColors: Record<string, string> = {
    paid:    '#2e7d5e',
    unpaid:  '#b86a00',
    overdue: '#c0392b',
    partial: '#6b4ca0',
  }
  const statusBg: Record<string, string> = {
    paid:    '#edf6f1',
    unpaid:  '#fef5e7',
    overdue: '#fdf0ee',
    partial: '#f3eefb',
  }
  const statusColor = statusColors[data.status] || '#7a7060'
  const statusBgCol = statusBg[data.status]     || '#f5f3ef'

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.logo}>IndustrialOS</Text>
            <Text style={S.logoSub}>Enterprise B2B Platform</Text>
          </View>
          <View>
            <Text style={S.docTitle}>INVOICE</Text>
            <Text style={S.docNumber}>{data.invoiceNumber}</Text>
            <View style={[S.badge, { backgroundColor: statusBgCol, marginTop: 6 }]}>
              <Text style={[S.badgeText, { color: statusColor }]}>
                {(data.status || 'unpaid').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Info grid */}
        <View style={S.infoGrid}>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Bill To</Text>
            <Text style={S.infoValue}>{data.customer}</Text>
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Issue Date</Text>
            <Text style={S.infoValue}>{fmtDate(data.issueDate)}</Text>
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Due Date</Text>
            <Text style={S.infoValue}>{fmtDate(data.dueDate)}</Text>
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Payment Terms</Text>
            <Text style={S.infoValue}>{data.paymentTerms || 'Net 30'}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={S.tableHeader}>
          <Text style={[S.colDesc,  S.colHeaderText]}>Description</Text>
          <Text style={[S.colQty,   S.colHeaderText]}>Qty</Text>
          <Text style={[S.colPrice, S.colHeaderText]}>Unit Price</Text>
          <Text style={[S.colTotal, S.colHeaderText]}>Total</Text>
        </View>

        {/* Table rows */}
        {items.map((item: any, i: number) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={S.colDesc}>{item.desc}</Text>
            <Text style={S.colQty}>{item.qty}</Text>
            <Text style={S.colPrice}>{fmtMoney(item.unitPrice)}</Text>
            <Text style={S.colTotal}>{fmtMoney(item.total)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={S.totalsBox}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{fmtMoney(data.subtotal)}</Text>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Tax (8%)</Text>
            <Text style={S.totalValue}>{fmtMoney(data.tax)}</Text>
          </View>
          {data.amountPaid > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Amount Paid</Text>
              <Text style={[S.totalValue, { color: '#2e7d5e' }]}>-{fmtMoney(data.amountPaid)}</Text>
            </View>
          )}
          <View style={S.divider} />
          <View style={S.totalRow}>
            <Text style={S.grandLabel}>Total Due</Text>
            <Text style={S.grandValue}>{fmtMoney(data.total - (data.amountPaid || 0))}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>Notes</Text>
            <Text style={S.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>IndustrialOS - Enterprise B2B Platform</Text>
          <Text style={S.footerText}>{data.invoiceNumber} · Generated {fmtDate(new Date().toISOString())}</Text>
        </View>

      </Page>
    </Document>
  )
}

// ── Quote PDF ─────────────────────────────────────────────────────────────────
export function QuotePDF({ data }: { data: any }) {
  const items = Array.isArray(data.items) ? data.items : []

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.logo}>⚡ IndustrialOS</Text>
            <Text style={S.logoSub}>Enterprise B2B Platform</Text>
          </View>
          <View>
            <Text style={S.docTitle}>QUOTATION</Text>
            <Text style={S.docNumber}>{data.quoteNumber}</Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={S.infoGrid}>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Prepared For</Text>
            <Text style={S.infoValue}>{data.customer}</Text>
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Date</Text>
            <Text style={S.infoValue}>{fmtDate(data.createdAt || new Date().toISOString())}</Text>
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Valid Until</Text>
            <Text style={S.infoValue}>{fmtDate(data.validUntil)}</Text>
          </View>
          <View style={S.infoBlock}>
            <Text style={S.infoLabel}>Payment Terms</Text>
            <Text style={S.infoValue}>{data.paymentTerms || 'Net 30'}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={S.tableHeader}>
          <Text style={[S.colDesc,  S.colHeaderText]}>Description</Text>
          <Text style={[S.colQty,   S.colHeaderText]}>Qty</Text>
          <Text style={[S.colPrice, S.colHeaderText]}>Unit Price</Text>
          <Text style={[S.colDisc,  S.colHeaderText]}>Disc %</Text>
          <Text style={[S.colTotal, S.colHeaderText]}>Total</Text>
        </View>

        {/* Table rows */}
        {items.map((item: any, i: number) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={S.colDesc}>{item.desc} {item.sku ? `(${item.sku})` : ''}</Text>
            <Text style={S.colQty}>{item.qty?.toLocaleString()}</Text>
            <Text style={S.colPrice}>{fmtMoney(item.unitPrice)}</Text>
            <Text style={S.colDisc}>{item.discount > 0 ? `${item.discount}%` : '—'}</Text>
            <Text style={S.colTotal}>{fmtMoney(item.total)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={S.totalsBox}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{fmtMoney(data.subtotal)}</Text>
          </View>
          {data.discountAmt > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Discount</Text>
              <Text style={[S.totalValue, { color: '#2e7d5e' }]}>-{fmtMoney(data.discountAmt)}</Text>
            </View>
          )}
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Tax (8%)</Text>
            <Text style={S.totalValue}>{fmtMoney(data.tax)}</Text>
          </View>
          <View style={S.divider} />
          <View style={S.totalRow}>
            <Text style={S.grandLabel}>Grand Total</Text>
            <Text style={S.grandValue}>{fmtMoney(data.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>Notes</Text>
            <Text style={S.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>IndustrialOS — Enterprise B2B Platform</Text>
          <Text style={S.footerText}>{data.quoteNumber} · Valid until {fmtDate(data.validUntil)}</Text>
        </View>

      </Page>
    </Document>
  )
}
