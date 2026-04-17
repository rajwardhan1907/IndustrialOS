// Shared automation helpers: notification dedup, credit check, auto-PO, etc.
// These helpers expect to be called inside a prisma transaction (tx argument).

type Tx = any

// ── Notifications ─────────────────────────────────────────────────────────────
// Dedup notifications by groupKey within a 5-minute window.
// If a matching (workspaceId, groupKey) notification exists in the last 5 min,
// skip creating a new one.
export async function createNotification(
  tx: Tx,
  data: {
    workspaceId: string
    type?: string
    severity?: string
    title: string
    body?: string
    tab?: string
    linkedType?: string
    linkedId?: string
    groupKey?: string
  },
) {
  const groupKey = data.groupKey ?? ''
  if (groupKey) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const existing = await tx.notification.findFirst({
      where: {
        workspaceId: data.workspaceId,
        groupKey,
        createdAt: { gte: fiveMinAgo },
      },
    })
    if (existing) return existing
  }
  return tx.notification.create({
    data: {
      workspaceId: data.workspaceId,
      type:        data.type     ?? 'info',
      severity:    data.severity ?? 'info',
      title:       data.title,
      body:        data.body     ?? '',
      tab:         data.tab      ?? '',
      linkedType:  data.linkedType ?? '',
      linkedId:    data.linkedId  ?? '',
      groupKey,
    },
  })
}

// ── Credit check ──────────────────────────────────────────────────────────────
// Returns { ok: true } or { ok: false, reason } if the customer is on hold or over limit.
export async function checkCustomerCredit(
  tx: Tx,
  workspaceId: string,
  customerName: string,
  additionalAmount = 0,
): Promise<{ ok: boolean; reason?: string; customerId?: string }> {
  if (!customerName) return { ok: true }
  const customer = await tx.customer.findFirst({
    where: { workspaceId, name: { mode: 'insensitive', equals: customerName } },
  })
  if (!customer) return { ok: true }

  if (customer.onCreditHold) {
    return {
      ok: false,
      reason: customer.creditHoldReason || 'Customer is on credit hold',
      customerId: customer.id,
    }
  }
  if (customer.creditLimit > 0) {
    const projected = customer.balanceDue + additionalAmount
    if (projected >= customer.creditLimit) {
      return {
        ok: false,
        reason: `Credit limit exceeded: $${projected.toFixed(2)} projected vs. $${customer.creditLimit.toFixed(2)} limit`,
        customerId: customer.id,
      }
    }
  }
  return { ok: true, customerId: customer.id }
}

// ── Contract validation ──────────────────────────────────────────────────────
export async function validateContractMinOrderQty(
  tx: Tx,
  workspaceId: string,
  customerName: string,
  qty: number,
): Promise<{ ok: boolean; reason?: string }> {
  const contract = await tx.contract.findFirst({
    where: {
      workspaceId,
      customer: { mode: 'insensitive', equals: customerName },
      status: { in: ['active', 'expiring'] },
    },
  })
  if (contract && contract.minOrderQty > 0 && qty < contract.minOrderQty) {
    return {
      ok: false,
      reason: `Order qty ${qty} below contract minimum ${contract.minOrderQty}`,
    }
  }
  return { ok: true }
}

// ── Auto-PO for low stock ─────────────────────────────────────────────────────
// Creates a PO for the given inventory item if its linked supplier exists and
// no open PO already exists for this SKU.
export async function createLowStockAutoPo(tx: Tx, invItem: any) {
  if (!invItem.supplierId) return null

  const supplier = await tx.supplier.findUnique({ where: { id: invItem.supplierId } })
  if (!supplier) return null

  // Avoid duplicate open auto-POs for the same SKU
  const existing = await tx.purchaseOrder.findFirst({
    where: {
      workspaceId: invItem.workspaceId,
      lowStockSkuId: invItem.id,
      status: { notIn: ['received', 'cancelled'] },
    },
  })
  if (existing) return existing

  const qty = Math.max(invItem.reorderQty ?? 0, 1)
  const unitCost = invItem.unitCost ?? 0
  const subtotal = qty * unitCost
  const count = await tx.purchaseOrder.count({ where: { workspaceId: invItem.workspaceId } })
  const poNumber = `PO-AUTO-${String(count + 1).padStart(4, '0')}`

  const expected = new Date()
  expected.setDate(expected.getDate() + (supplier.leadTimeDays ?? 14))

  const po = await tx.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: [{ sku: invItem.sku, name: invItem.name, qty, unitCost }],
      subtotal,
      tax: 0,
      total: subtotal,
      status: 'draft',
      paymentTerms: supplier.paymentTerms ?? 'Net 30',
      expectedDate: expected.toISOString().split('T')[0],
      notes: `Auto-generated from low stock on ${invItem.sku}`,
      approvalStatus: 'not_required',
      isAutoPo: true,
      triggeredByLowStock: true,
      lowStockSkuId: invItem.id,
      workspaceId: invItem.workspaceId,
    },
  })

  await tx.inventoryItem.update({
    where: { id: invItem.id },
    data: {
      lastPoDate: new Date().toISOString().split('T')[0],
      autoPoCount: (invItem.autoPoCount ?? 0) + 1,
    },
  })

  return po
}

// ── Low-stock ticket ──────────────────────────────────────────────────────────
export async function createLowStockTicket(tx: Tx, invItem: any) {
  const openTicket = await tx.ticket.findFirst({
    where: {
      linkedId: invItem.id,
      linkedType: 'inventory',
      workspaceId: invItem.workspaceId,
      status: { notIn: ['resolved', 'closed'] },
    },
  })
  if (openTicket) return openTicket
  const count = await tx.ticket.count({ where: { workspaceId: invItem.workspaceId } })
  return tx.ticket.create({
    data: {
      ticketNumber: `TKT-${String(count + 1).padStart(3, '0')}`,
      title: `Low stock: ${invItem.name} (${invItem.sku})`,
      description: `Stock level ${invItem.stockLevel} has reached or dropped below reorder point of ${invItem.reorderPoint}. Reorder qty: ${invItem.reorderQty}.`,
      type: 'alert',
      priority: 'high',
      status: 'open',
      linkedType: 'inventory',
      linkedId: invItem.id,
      linkedLabel: `${invItem.name} — ${invItem.sku}`,
      workspaceId: invItem.workspaceId,
    },
  })
}

// ── Supplier scoring update ───────────────────────────────────────────────────
// Called when a PO is received. Updates supplier's on-time delivery percentage.
export async function updateSupplierScore(tx: Tx, supplierId: string, onTime: boolean) {
  if (!supplierId) return
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId } })
  if (!supplier) return
  const prevTotal = supplier.totalOrdersCount ?? 0
  const prevPercent = supplier.onTimeDeliveryPercent ?? 100
  const prevOnTimeCount = (prevPercent / 100) * prevTotal
  const newTotal = prevTotal + 1
  const newOnTimeCount = prevOnTimeCount + (onTime ? 1 : 0)
  const newPercent = (newOnTimeCount / newTotal) * 100
  await tx.supplier.update({
    where: { id: supplierId },
    data: {
      totalOrdersCount: newTotal,
      onTimeDeliveryPercent: newPercent,
      lastPoDate: new Date().toISOString().split('T')[0],
    },
  })
}

// ── AR aging (DSO) for customer ──────────────────────────────────────────────
export async function recalcDSO(tx: Tx, workspaceId: string, customerName: string) {
  const customer = await tx.customer.findFirst({
    where: { workspaceId, name: { mode: 'insensitive', equals: customerName } },
  })
  if (!customer) return
  const unpaid = await tx.invoice.findMany({
    where: {
      workspaceId,
      customer: { mode: 'insensitive', equals: customerName },
      status: { not: 'paid' },
    },
    orderBy: { issueDate: 'asc' },
    take: 1,
  })
  let dso = 0
  if (unpaid.length > 0) {
    const issued = new Date(unpaid[0].issueDate)
    if (!isNaN(issued.getTime())) {
      dso = Math.floor((Date.now() - issued.getTime()) / 86400000)
    }
  }
  await tx.customer.update({
    where: { id: customer.id },
    data: { daysSalesOutstanding: dso },
  })
}

// ── Numeric validation helpers ────────────────────────────────────────────────
export function validatePositive(value: any, label: string, allowZero = false): string | null {
  if (value === undefined || value === null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return `${label} must be a number`
  if (allowZero ? n < 0 : n <= 0) return `${label} must be ${allowZero ? 'non-negative' : 'positive'}`
  return null
}

export function validateNonNegative(value: any, label: string): string | null {
  return validatePositive(value, label, true)
}
