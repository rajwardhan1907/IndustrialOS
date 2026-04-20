// prisma/seed.ts
// Demo seed for IndustrialOS — creates one workspace with realistic data
// so a buyer can log in and explore a fully populated app.
//
// Run: npx prisma db seed
// Login after: admin@demo.com / demo1234

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo workspace...");

  // ── Clean slate ────────────────────────────────────────────────────────────
  // Delete in reverse-dependency order so FK constraints don't block
  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.ediTransaction.deleteMany();
  await prisma.ediPartner.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.return.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();

  // ── Workspace ──────────────────────────────────────────────────────────────
  const ws = await prisma.workspace.create({
    data: {
      name: "Apex Industrial Supply",
      industry: "Industrial Manufacturing",
      currency: "USD",
      poApprovalThreshold: 5000,
      whatsappEnabled: false,
      returnAddress: "Apex Industrial Supply, 4200 Commerce Blvd, Chicago IL 60601",
      returnInstructions: "Include RMA number on outer box. Do not ship without prior approval.",
    },
  });

  // ── Users ──────────────────────────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  await prisma.user.createMany({
    data: [
      { name: "Alex Morgan",   email: "admin@demo.com",    password: hash("demo1234"), role: "admin",    workspaceId: ws.id },
      { name: "Sam Rivera",    email: "ops@demo.com",      password: hash("demo1234"), role: "operator", workspaceId: ws.id },
      { name: "Jordan Lee",    email: "viewer@demo.com",   password: hash("demo1234"), role: "viewer",   workspaceId: ws.id },
    ],
  });

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: {
      name: "Greystone Metals",     contactName: "Diana Park",   email: "diana@greystonemetals.com",
      phone: "+1-312-555-0101",     country: "United States",    category: "raw_materials",
      status: "active",             paymentTerms: "Net 30",       leadTimeDays: 10, rating: 5,
      notes: "Primary steel supplier. Reliable delivery, competitive pricing.",
      workspaceId: ws.id,
    }}),
    prisma.supplier.create({ data: {
      name: "FastenerPro Ltd",      contactName: "Marcus Webb",  email: "marcus@fastenerpro.com",
      phone: "+44-20-5550-0202",    country: "United Kingdom",   category: "components",
      status: "active",             paymentTerms: "Net 45",       leadTimeDays: 18, rating: 4,
      notes: "Bolt and fastener specialist. Good for bulk orders.",
      workspaceId: ws.id,
    }}),
    prisma.supplier.create({ data: {
      name: "Zhen Electronics",     contactName: "Li Wei",       email: "liwei@zhenelec.cn",
      phone: "+86-21-5550-0303",    country: "China",            category: "electronics",
      status: "active",             paymentTerms: "Net 60",       leadTimeDays: 25, rating: 4,
      notes: "Circuit boards and sensors. Longer lead times, budget pricing.",
      workspaceId: ws.id,
    }}),
    prisma.supplier.create({ data: {
      name: "Nordic Polymers",      contactName: "Astrid Holm",  email: "astrid@nordicpoly.se",
      phone: "+46-8-5550-0404",     country: "Sweden",           category: "raw_materials",
      status: "active",             paymentTerms: "Net 30",       leadTimeDays: 14, rating: 3,
      notes: "Specialty plastics and polymer compounds.",
      workspaceId: ws.id,
    }}),
  ]);

  // ── Customers ──────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.create({ data: {
      name: "Torchlight Engineering",  contactName: "Rachel Kim",    email: "rachel@torchlight.com",
      phone: "+1-415-555-0501",        country: "United States",     industry: "Aerospace",
      creditLimit: 150000,             balanceDue: 12400,            totalSpend: 287600,
      status: "active",                portalCode: "TORCH-001",      paymentTerms: "Net 30",
      notes: "Top customer. Prefers early delivery.",                 orders: "[]",
      workspaceId: ws.id,
    }}),
    prisma.customer.create({ data: {
      name: "Blueridge Fabrication",   contactName: "Tom Harley",    email: "tom@blueridgefab.com",
      phone: "+1-303-555-0502",        country: "United States",     industry: "Construction",
      creditLimit: 75000,              balanceDue: 5200,             totalSpend: 134800,
      status: "active",                portalCode: "BLUE-002",       paymentTerms: "Net 45",
      notes: "Monthly standing orders for structural steel.",         orders: "[]",
      workspaceId: ws.id,
    }}),
    prisma.customer.create({ data: {
      name: "Meridian Automation",     contactName: "Priya Sharma",  email: "priya@meridianautomation.in",
      phone: "+91-22-5550-0503",       country: "India",             industry: "Manufacturing",
      creditLimit: 60000,              balanceDue: 0,                totalSpend: 89200,
      status: "active",                portalCode: "MERI-003",       paymentTerms: "Net 30",
      notes: "Growing account. Strong demand for sensors and circuits.", orders: "[]",
      workspaceId: ws.id,
    }}),
    prisma.customer.create({ data: {
      name: "Crestview Utilities",     contactName: "Brian Walsh",   email: "brian@crestview.co.uk",
      phone: "+44-161-555-0504",       country: "United Kingdom",    industry: "Energy",
      creditLimit: 100000,             balanceDue: 31750,            totalSpend: 412300,
      status: "active",                portalCode: "CRES-004",       paymentTerms: "Net 60",
      notes: "Large account. Slow payer but high volume.",            orders: "[]",
      workspaceId: ws.id,
    }}),
    prisma.customer.create({ data: {
      name: "Delta Robotics GmbH",     contactName: "Hans Müller",   email: "hans@deltarobotics.de",
      phone: "+49-89-5550-0505",       country: "Germany",           industry: "Robotics",
      creditLimit: 200000,             balanceDue: 0,                totalSpend: 198000,
      status: "active",                portalCode: "DELT-005",       paymentTerms: "Net 30",
      notes: "Premium customer. Always pays on time.",                orders: "[]",
      workspaceId: ws.id,
    }}),
  ]);

  // ── Inventory ──────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const inventory = await Promise.all([
    prisma.inventoryItem.create({ data: { sku: "STL-BEAM-H100", name: "H-Section Steel Beam 100mm",   category: "Structural Steel",   stockLevel: 340, reorderPoint: 100, reorderQty: 200, unitCost: 84.50,  warehouse: "WH-A", zone: "A", binLocation: "A-01-03", lastSynced: today, supplier: "Greystone Metals",  workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "STL-PLATE-6MM", name: "Steel Plate 6mm 1200x2400",    category: "Structural Steel",   stockLevel: 82,  reorderPoint: 50,  reorderQty: 100, unitCost: 210.00, warehouse: "WH-A", zone: "A", binLocation: "A-02-01", lastSynced: today, supplier: "Greystone Metals",  workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "FAS-BOLT-M12",  name: "M12 Hex Bolt Grade 8.8 (x100)", category: "Fasteners",         stockLevel: 28,  reorderPoint: 50,  reorderQty: 200, unitCost: 18.75,  warehouse: "WH-B", zone: "B", binLocation: "B-01-05", lastSynced: today, supplier: "FastenerPro Ltd",   workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "FAS-NUT-M12",   name: "M12 Hex Nut Grade 8 (x100)",    category: "Fasteners",         stockLevel: 45,  reorderPoint: 50,  reorderQty: 200, unitCost: 9.20,   warehouse: "WH-B", zone: "B", binLocation: "B-01-06", lastSynced: today, supplier: "FastenerPro Ltd",   workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "ELC-SENSOR-PT",  name: "Pressure Transducer 0-10 bar",  category: "Electronics",       stockLevel: 63,  reorderPoint: 20,  reorderQty: 50,  unitCost: 145.00, warehouse: "WH-C", zone: "C", binLocation: "C-03-02", lastSynced: today, supplier: "Zhen Electronics",  workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "ELC-PCB-CTL",   name: "Industrial Control PCB v2.1",   category: "Electronics",       stockLevel: 19,  reorderPoint: 15,  reorderQty: 30,  unitCost: 320.00, warehouse: "WH-C", zone: "C", binLocation: "C-03-05", lastSynced: today, supplier: "Zhen Electronics",  workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "PLY-ABS-3MM",   name: "ABS Sheet 3mm 1000x1000",       category: "Polymers",          stockLevel: 156, reorderPoint: 40,  reorderQty: 100, unitCost: 34.60,  warehouse: "WH-A", zone: "B", binLocation: "B-04-01", lastSynced: today, supplier: "Nordic Polymers",   workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "PLY-NYLON-ROD",  name: "Nylon Rod 40mm Dia x 1m",      category: "Polymers",          stockLevel: 74,  reorderPoint: 25,  reorderQty: 50,  unitCost: 22.80,  warehouse: "WH-A", zone: "B", binLocation: "B-04-03", lastSynced: today, supplier: "Nordic Polymers",   workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "STL-PIPE-50NB",  name: "Steel Pipe 50NB Sch40 x 6m",   category: "Structural Steel",  stockLevel: 8,   reorderPoint: 20,  reorderQty: 40,  unitCost: 187.00, warehouse: "WH-A", zone: "A", binLocation: "A-03-02", lastSynced: today, supplier: "Greystone Metals",  workspaceId: ws.id }}),
    prisma.inventoryItem.create({ data: { sku: "ELC-RELAY-24V",  name: "24V DC Relay Module (10A)",     category: "Electronics",       stockLevel: 112, reorderPoint: 30,  reorderQty: 80,  unitCost: 28.40,  warehouse: "WH-C", zone: "C", binLocation: "C-01-08", lastSynced: today, supplier: "Zhen Electronics",  workspaceId: ws.id }}),
  ]);

  // ── Orders ────────────────────────────────────────────────────────────────
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
  const orders = await Promise.all([
    prisma.order.create({ data: { customer: "Torchlight Engineering",  sku: "STL-BEAM-H100", items: 40,  value: 3380,  stage: "Delivered", priority: "HIGH", source: "portal",  notes: "Urgent delivery requested.", workspaceId: ws.id, createdAt: daysAgo(18) }}),
    prisma.order.create({ data: { customer: "Crestview Utilities",     sku: "ELC-SENSOR-PT", items: 20,  value: 2900,  stage: "Shipped",   priority: "MED",  source: "manual",  notes: "", workspaceId: ws.id, createdAt: daysAgo(10) }}),
    prisma.order.create({ data: { customer: "Blueridge Fabrication",   sku: "STL-PLATE-6MM", items: 15,  value: 3150,  stage: "Confirmed", priority: "MED",  source: "manual",  notes: "Standard monthly order.", workspaceId: ws.id, createdAt: daysAgo(7) }}),
    prisma.order.create({ data: { customer: "Delta Robotics GmbH",     sku: "ELC-PCB-CTL",   items: 10,  value: 3200,  stage: "Picked",    priority: "HIGH", source: "portal",  notes: "Batch 3 of 5.", workspaceId: ws.id, createdAt: daysAgo(5) }}),
    prisma.order.create({ data: { customer: "Meridian Automation",     sku: "ELC-RELAY-24V", items: 50,  value: 1420,  stage: "Placed",    priority: "LOW",  source: "manual",  notes: "", workspaceId: ws.id, createdAt: daysAgo(3) }}),
    prisma.order.create({ data: { customer: "Torchlight Engineering",  sku: "FAS-BOLT-M12",  items: 200, value: 3750,  stage: "Placed",    priority: "MED",  source: "portal",  notes: "Restock order.", workspaceId: ws.id, createdAt: daysAgo(2) }}),
    prisma.order.create({ data: { customer: "Crestview Utilities",     sku: "STL-PIPE-50NB", items: 12,  value: 2244,  stage: "Confirmed", priority: "HIGH", source: "manual",  notes: "Site deadline in 10 days.", workspaceId: ws.id, createdAt: daysAgo(1) }}),
    prisma.order.create({ data: { customer: "Blueridge Fabrication",   sku: "PLY-ABS-3MM",   items: 30,  value: 1038,  stage: "Placed",    priority: "LOW",  source: "manual",  notes: "", workspaceId: ws.id, createdAt: daysAgo(0) }}),
  ]);

  // ── Invoices ──────────────────────────────────────────────────────────────
  const fmtDate = (d: Date) => d.toISOString().split("T")[0];
  await Promise.all([
    prisma.invoice.create({ data: {
      invoiceNumber: "INV-001", customer: "Torchlight Engineering",
      items: [{ description: "H-Section Steel Beam 100mm x40", qty: 40, unitPrice: 84.50, total: 3380 }],
      subtotal: 3380, tax: 304.20, total: 3684.20, amountPaid: 3684.20,
      paymentTerms: "Net 30", issueDate: fmtDate(daysAgo(18)), dueDate: fmtDate(daysAgo(0)),
      status: "paid", currency: "USD", workspaceId: ws.id,
    }}),
    prisma.invoice.create({ data: {
      invoiceNumber: "INV-002", customer: "Crestview Utilities",
      items: [{ description: "Pressure Transducer 0-10 bar x20", qty: 20, unitPrice: 145, total: 2900 }],
      subtotal: 2900, tax: 261, total: 3161, amountPaid: 0,
      paymentTerms: "Net 60", issueDate: fmtDate(daysAgo(10)), dueDate: fmtDate(new Date(Date.now() + 50 * 86400000)),
      status: "unpaid", currency: "USD", workspaceId: ws.id,
    }}),
    prisma.invoice.create({ data: {
      invoiceNumber: "INV-003", customer: "Delta Robotics GmbH",
      items: [{ description: "Industrial Control PCB v2.1 x10", qty: 10, unitPrice: 320, total: 3200 }],
      subtotal: 3200, tax: 288, total: 3488, amountPaid: 1500,
      paymentTerms: "Net 30", issueDate: fmtDate(daysAgo(5)), dueDate: fmtDate(new Date(Date.now() + 25 * 86400000)),
      status: "partial", currency: "USD", workspaceId: ws.id,
    }}),
    prisma.invoice.create({ data: {
      invoiceNumber: "INV-004", customer: "Blueridge Fabrication",
      items: [{ description: "Steel Plate 6mm x15", qty: 15, unitPrice: 210, total: 3150 }],
      subtotal: 3150, tax: 283.50, total: 3433.50, amountPaid: 0,
      paymentTerms: "Net 45", issueDate: fmtDate(daysAgo(50)), dueDate: fmtDate(daysAgo(5)),
      status: "overdue", currency: "USD", workspaceId: ws.id,
    }}),
  ]);

  // ── Quotes ────────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.quote.create({ data: {
      quoteNumber: "QT-001", customer: "Meridian Automation",
      items: [{ description: "Pressure Transducer 0-10 bar", qty: 30, unitPrice: 138, total: 4140 }],
      subtotal: 4140, discountAmt: 207, tax: 353.43, total: 4286.43,
      validUntil: fmtDate(new Date(Date.now() + 14 * 86400000)),
      paymentTerms: "Net 30", notes: "5% volume discount applied.", status: "sent",
      prompt: "30 pressure transducers, budget ~$140 each, Net 30",
      workspaceId: ws.id,
    }}),
    prisma.quote.create({ data: {
      quoteNumber: "QT-002", customer: "Crestview Utilities",
      items: [
        { description: "Steel Pipe 50NB Sch40 x6m", qty: 20, unitPrice: 178, total: 3560 },
        { description: "M12 Hex Bolt Grade 8.8 x100", qty: 10, unitPrice: 17.50, total: 175 },
      ],
      subtotal: 3735, discountAmt: 0, tax: 336.15, total: 4071.15,
      validUntil: fmtDate(new Date(Date.now() + 7 * 86400000)),
      paymentTerms: "Net 60", notes: "", status: "draft",
      prompt: "Steel pipe and fasteners for site install",
      workspaceId: ws.id,
    }}),
    prisma.quote.create({ data: {
      quoteNumber: "QT-003", customer: "Delta Robotics GmbH",
      items: [{ description: "24V DC Relay Module x100", qty: 100, unitPrice: 26, total: 2600 }],
      subtotal: 2600, discountAmt: 130, tax: 221, total: 2691,
      validUntil: fmtDate(daysAgo(2)),
      paymentTerms: "Net 30", notes: "Accepted by customer.", status: "accepted",
      prompt: "100 relay modules, bulk pricing",
      workspaceId: ws.id,
    }}),
  ]);

  // ── Purchase Orders ───────────────────────────────────────────────────────
  await Promise.all([
    prisma.purchaseOrder.create({ data: {
      poNumber: "PO-001", supplierId: suppliers[0].id, supplierName: "Greystone Metals",
      items: [{ description: "H-Section Steel Beam 100mm", qty: 200, unitPrice: 80, total: 16000 }],
      subtotal: 16000, tax: 1440, total: 17440,
      status: "approved", paymentTerms: "Net 30",
      expectedDate: fmtDate(new Date(Date.now() + 10 * 86400000)),
      approvalStatus: "approved", approvedBy: "admin@demo.com",
      approvedAt: fmtDate(daysAgo(3)),
      notes: "Regular restocking order.",
      workspaceId: ws.id,
    }}),
    prisma.purchaseOrder.create({ data: {
      poNumber: "PO-002", supplierId: suppliers[1].id, supplierName: "FastenerPro Ltd",
      items: [
        { description: "M12 Hex Bolt Grade 8.8 x100", qty: 200, unitPrice: 17.50, total: 3500 },
        { description: "M12 Hex Nut Grade 8 x100",    qty: 200, unitPrice: 8.80,  total: 1760 },
      ],
      subtotal: 5260, tax: 473.40, total: 5733.40,
      status: "pending", paymentTerms: "Net 45",
      expectedDate: fmtDate(new Date(Date.now() + 18 * 86400000)),
      approvalStatus: "pending",
      notes: "Awaiting approval — above threshold.",
      workspaceId: ws.id,
    }}),
  ]);

  // ── Shipments ─────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.shipment.create({ data: {
      shipmentNumber: "SHP-001", customer: "Torchlight Engineering",
      carrier: "FedEx Freight", trackingNumber: "784512369851",
      status: "delivered",
      origin: "Chicago, IL", destination: "San Jose, CA",
      weight: "820 kg", estimatedDate: fmtDate(daysAgo(2)),
      deliveredDate: fmtDate(daysAgo(1)),
      events: [
        { date: fmtDate(daysAgo(5)), event: "Picked up from warehouse" },
        { date: fmtDate(daysAgo(3)), event: "In transit — Denver hub" },
        { date: fmtDate(daysAgo(1)), event: "Delivered — signed by R. Kim" },
      ],
      notes: "", workspaceId: ws.id,
    }}),
    prisma.shipment.create({ data: {
      shipmentNumber: "SHP-002", customer: "Crestview Utilities",
      carrier: "UPS Freight", trackingNumber: "1Z8F29870341892764",
      status: "in_transit",
      origin: "Chicago, IL", destination: "Manchester, UK",
      weight: "290 kg", estimatedDate: fmtDate(new Date(Date.now() + 5 * 86400000)),
      deliveredDate: "",
      events: [
        { date: fmtDate(daysAgo(4)), event: "Collected from warehouse" },
        { date: fmtDate(daysAgo(2)), event: "Cleared customs — O'Hare" },
        { date: fmtDate(daysAgo(1)), event: "In transit — international" },
      ],
      notes: "International shipment — allow 12 business days.", workspaceId: ws.id,
    }}),
  ]);

  // ── Returns ───────────────────────────────────────────────────────────────
  await prisma.return.create({ data: {
    rmaNumber: "RMA-001", customer: "Blueridge Fabrication",
    sku: "FAS-BOLT-M12", qty: 50, reason: "defective",
    description: "25% of bolts had stripped threads on arrival.",
    status: "approved", refundAmount: 937.50, refundMethod: "credit",
    customerEmail: "tom@blueridgefab.com",
    notes: "Credit note issued. Replacement shipped with next order.",
    workspaceId: ws.id,
  }});

  // ── Contracts ─────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.contract.create({ data: {
      contractNumber: "CTR-001", title: "Annual Supply Agreement 2026",
      customer: "Torchlight Engineering", minOrderQty: 20, agreedPricing: "5% below list price on all steel",
      deliverySLA: 7, value: 480000,
      startDate: "2026-01-01", expiryDate: "2026-12-31", status: "active",
      notes: "Renewed Feb 2026. Price review in October.",
      workspaceId: ws.id,
    }}),
    prisma.contract.create({ data: {
      contractNumber: "CTR-002", title: "Preferred Supplier Agreement",
      customer: "Delta Robotics GmbH", minOrderQty: 10, agreedPricing: "Fixed rate on PCB and relay modules",
      deliverySLA: 10, value: 250000,
      startDate: "2026-03-01",
      expiryDate: fmtDate(new Date(Date.now() + 28 * 86400000)),
      status: "expiring",
      notes: "Renewal discussion scheduled for next month.",
      workspaceId: ws.id,
    }}),
  ]);

  // ── Pricing Rules ─────────────────────────────────────────────────────────
  await Promise.all([
    prisma.pricingRule.create({ data: {
      name: "Bulk 100+ units — 5% off", type: "volume",
      minQty: 100, discountPct: 5, active: true, workspaceId: ws.id,
    }}),
    prisma.pricingRule.create({ data: {
      name: "Torchlight Engineering — VIP 8%", type: "customer",
      customerName: "Torchlight Engineering", discountPct: 8, active: true, workspaceId: ws.id,
    }}),
    prisma.pricingRule.create({ data: {
      name: "Delta Robotics — Fixed 6%", type: "customer",
      customerName: "Delta Robotics GmbH", discountPct: 6, active: true, workspaceId: ws.id,
    }}),
  ]);

  // ── Tickets ───────────────────────────────────────────────────────────────
  const tickets = await Promise.all([
    prisma.ticket.create({ data: {
      ticketNumber: "TKT-001", title: "M12 Bolt stock critically low",
      description: "FAS-BOLT-M12 is at 28 units — below reorder point of 50. PO-002 is pending approval.",
      type: "alert", priority: "high", status: "open",
      assignedTo: "", assignedName: "", raisedBy: "system", raisedName: "System",
      linkedType: "inventory", linkedId: "FAS-BOLT-M12", linkedLabel: "FAS-BOLT-M12",
      workspaceId: ws.id,
    }}),
    prisma.ticket.create({ data: {
      ticketNumber: "TKT-002", title: "INV-004 Blueridge overdue — follow up",
      description: "Invoice INV-004 for Blueridge Fabrication is 5 days overdue. No payment or contact received.",
      type: "issue", priority: "urgent", status: "in_progress",
      assignedTo: "ops@demo.com", assignedName: "Sam Rivera",
      raisedBy: "admin@demo.com", raisedName: "Alex Morgan",
      linkedType: "invoice", linkedId: "INV-004", linkedLabel: "INV-004",
      workspaceId: ws.id,
    }}),
    prisma.ticket.create({ data: {
      ticketNumber: "TKT-003", title: "Add Meridian Automation to portal",
      description: "Priya from Meridian has asked for portal access. Assign portal code and send invite.",
      type: "request", priority: "medium", status: "resolved",
      assignedTo: "ops@demo.com", assignedName: "Sam Rivera",
      raisedBy: "admin@demo.com", raisedName: "Alex Morgan",
      linkedType: "customer", linkedId: "", linkedLabel: "Meridian Automation",
      workspaceId: ws.id,
    }}),
  ]);

  await prisma.ticketComment.createMany({ data: [
    {
      ticketId: tickets[1].id, authorId: "admin@demo.com", authorName: "Alex Morgan",
      body: "Called the AP department — no answer. Sent follow-up email.",
    },
    {
      ticketId: tickets[1].id, authorId: "ops@demo.com", authorName: "Sam Rivera",
      body: "Email bounced. Trying direct contact for Brian Walsh.",
    },
    {
      ticketId: tickets[2].id, authorId: "ops@demo.com", authorName: "Sam Rivera",
      body: "Portal code MERI-003 assigned and emailed to priya@meridianautomation.in.",
    },
  ]});

  // ── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({ data: [
    { workspaceId: ws.id, type: "inventory", severity: "warn",  title: "Low stock: FAS-BOLT-M12",       body: "Stock at 28 units — below reorder point of 50.",      tab: "inventory", read: false },
    { workspaceId: ws.id, type: "inventory", severity: "warn",  title: "Low stock: STL-PIPE-50NB",      body: "Stock at 8 units — below reorder point of 20.",       tab: "inventory", read: false },
    { workspaceId: ws.id, type: "invoice",   severity: "error", title: "Overdue: INV-004",              body: "Blueridge Fabrication — $3,433.50 overdue 5 days.",   tab: "invoicing", read: false },
    { workspaceId: ws.id, type: "order",     severity: "info",  title: "New portal order from Torchlight", body: "Order for FAS-BOLT-M12 x200 placed via portal.",   tab: "orders",    read: true  },
    { workspaceId: ws.id, type: "ticket",    severity: "warn",  title: "Ticket TKT-001 opened",         body: "M12 Bolt stock auto-alert raised by system.",         tab: "tickets",   read: true  },
  ]});

  // ── EDI Partner ───────────────────────────────────────────────────────────
  const ediPartner = await prisma.ediPartner.create({ data: {
    name: "Torchlight Engineering EDI", standard: "X12",
    isaQualifier: "01", isaId: "TORCHLIGHT0001",
    partnerQual:  "01", partnerId: "APEXINDUSTRIA1",
    txSets: "850,855,856,810", active: true,
    notes: "X12 EDI for PO, PO Ack, ASN, Invoice.",
    workspaceId: ws.id,
  }});

  await prisma.ediTransaction.create({ data: {
    direction: "inbound", standard: "X12", txSet: "850",
    controlNumber: "000001", partnerId: ediPartner.id,
    status: "processed",
    rawPayload: "ISA*00*          *00*          *01*TORCHLIGHT0001 *01*APEXINDUSTRIA1*260410*1200*U*00401*000000001*0*P*>~GS*PO*TORCHLIGHT*APEX*20260410*1200*1*X*004010~ST*850*0001~BEG*00*NE*PO-DEMO-001**20260410~PO1*1*40*EA*84.50**BP*STL-BEAM-H100~CTT*1~SE*5*0001~GE*1*1~IEA*1*000000001~",
    parsedJson: { poNumber: "PO-DEMO-001", items: [{ sku: "STL-BEAM-H100", qty: 40, price: 84.50 }] },
    workspaceId: ws.id,
  }});

  console.log(`✅ Demo workspace created: "${ws.name}"`);
  console.log(`   Workspace ID: ${ws.id}`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`   Admin:    admin@demo.com  / demo1234`);
  console.log(`   Operator: ops@demo.com    / demo1234`);
  console.log(`   Viewer:   viewer@demo.com / demo1234`);
  console.log(`\n🌐 Customer portal codes:`);
  console.log(`   Torchlight Engineering: TORCH-001`);
  console.log(`   Blueridge Fabrication:  BLUE-002`);
  console.log(`   Meridian Automation:    MERI-003`);
  console.log(`   Crestview Utilities:    CRES-004`);
  console.log(`   Delta Robotics GmbH:    DELT-005`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
