// app/api/edi/inbound/route.ts — Receive + parse an EDI message (Phase 23)
// POST body: { workspaceId, partnerId, rawPayload }
// Parses the payload, stores the transaction, and if it's an 850/ORDERS
// also auto-creates a Purchase Order in the system.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseX12 } from "@/lib/edi/x12";
import { parseEdifact } from "@/lib/edi/edifact";
import { EdiDocument } from "@/lib/edi/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, partnerId, rawPayload } = body as {
      workspaceId: string;
      partnerId:   string;
      rawPayload:  string;
    };

    if (!workspaceId || !partnerId || !rawPayload) {
      return NextResponse.json({ error: "workspaceId, partnerId, rawPayload required" }, { status: 400 });
    }

    // Verify partner belongs to workspace
    const partner = await prisma.ediPartner.findFirst({ where: { id: partnerId, workspaceId } });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    // Detect standard and parse
    let parsed: EdiDocument;
    const isEdifact = rawPayload.trimStart().startsWith("UNA") || rawPayload.trimStart().startsWith("UNB");
    const standard  = isEdifact ? "EDIFACT" : "X12";

    try {
      parsed = isEdifact ? parseEdifact(rawPayload) : parseX12(rawPayload);
    } catch (parseErr: any) {
      // Store as error transaction
      const tx = await prisma.ediTransaction.create({
        data: {
          direction:     "inbound",
          standard,
          txSet:         "UNKNOWN",
          controlNumber: "",
          partnerId,
          workspaceId,
          status:        "error",
          rawPayload,
          errorMsg:      parseErr.message ?? "Parse failed",
        },
      });
      return NextResponse.json({ transactionId: tx.id, status: "error", error: parseErr.message }, { status: 422 });
    }

    const txSet = mapTxSet(parsed);

    // Store the transaction
    const tx = await prisma.ediTransaction.create({
      data: {
        direction:     "inbound",
        standard,
        txSet,
        controlNumber: parsed.controlNumber,
        partnerId,
        workspaceId,
        status:        "received",
        rawPayload,
        parsedJson:    parsed as any,
        errorMsg:      "",
      },
    });

    // ── Auto-process: 850 / ORDERS → create Purchase Order ───────────────────
    let autoAction: string | null = null;
    if (parsed.type === "PurchaseOrder") {
      const po = parsed;
      // Find or use a default supplier matching the partner name
      const supplier = await prisma.supplier.findFirst({ where: { workspaceId, name: { contains: partner.name.split(" ")[0] } } });

      await prisma.purchaseOrder.create({
        data: {
          poNumber:      po.poNumber || `EDI-${Date.now()}`,
          supplierId:    supplier?.id ?? "",
          supplierName:  po.vendorParty.name || partner.name,
          items:         po.lines as any,
          subtotal:      po.totalValue,
          tax:           0,
          total:         po.totalValue,
          status:        "draft",
          paymentTerms:  po.paymentTerms,
          expectedDate:  po.requestedDate || "",
          notes:         `Auto-created from EDI ${standard} ${txSet} — transaction ${tx.id}`,
          approvalStatus:"not_required",
          workspaceId,
        },
      });
      autoAction = "PurchaseOrder created";

      // Mark transaction as processed
      await prisma.ediTransaction.update({ where: { id: tx.id }, data: { status: "processed" } });
    }

    // ── Auto-process: 810 / INVOIC → create Invoice ──────────────────────────
    if (parsed.type === "Invoice") {
      const inv = parsed;
      await prisma.invoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber || `EDI-INV-${Date.now()}`,
          customer:      inv.buyerParty.name || partner.name,
          items:         inv.lines as any,
          subtotal:      inv.subtotal,
          tax:           inv.taxAmt,
          total:         inv.totalAmt,
          amountPaid:    0,
          paymentTerms:  inv.paymentTerms,
          issueDate:     inv.invoiceDate,
          dueDate:       inv.dueDate,
          status:        "unpaid",
          notes:         `Auto-created from EDI ${standard} ${txSet}`,
          currency:      inv.currency,
          workspaceId,
        },
      });
      autoAction = "Invoice created";
      await prisma.ediTransaction.update({ where: { id: tx.id }, data: { status: "processed" } });
    }

    return NextResponse.json({
      transactionId: tx.id,
      status:        "received",
      txSet,
      standard,
      parsed,
      autoAction,
    });
  } catch (err: any) {
    console.error("EDI inbound error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function mapTxSet(doc: EdiDocument): string {
  const map: Record<string, string> = {
    PurchaseOrder: doc.standard === "X12" ? "850" : "ORDERS",
    Invoice:       doc.standard === "X12" ? "810" : "INVOIC",
    PoAck:         doc.standard === "X12" ? "855" : "ORDRSP",
    ASN:           doc.standard === "X12" ? "856" : "DESADV",
  };
  return map[doc.type] ?? "UNKNOWN";
}
