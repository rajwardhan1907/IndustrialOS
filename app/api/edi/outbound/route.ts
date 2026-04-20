// app/api/edi/outbound/route.ts — Generate + send outbound EDI (Phase 23)
// POST body: { workspaceId, partnerId, docType, sourceId }
// docType: "810" | "855" | "856" | "INVOIC" | "ORDRSP" | "DESADV"
// sourceId: the internal DB record to generate the EDI from
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateX12 } from "@/lib/edi/x12";
import { generateEdifact } from "@/lib/edi/edifact";
import { EdiDocument, EdiPartnerConfig, EdiParty, EdiLineItem } from "@/lib/edi/types";

function emptyParty(): EdiParty {
  return { id: "", name: "", address1: "", city: "", state: "", zip: "", country: "" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspaceId, partnerId, docType, sourceId } = body as {
      workspaceId: string;
      partnerId:   string;
      docType:     string;
      sourceId:    string;
    };

    if (!workspaceId || !partnerId || !docType) {
      return NextResponse.json({ error: "workspaceId, partnerId, docType required" }, { status: 400 });
    }

    const partner = await prisma.ediPartner.findFirst({ where: { id: partnerId, workspaceId } });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const cfg: EdiPartnerConfig = {
      standard:      partner.standard as "X12" | "EDIFACT",
      isaQualifier:  partner.isaQualifier,
      isaId:         partner.isaId,
      partnerQual:   partner.partnerQual,
      partnerId:     partner.partnerId,
      unbSenderId:   partner.unbSenderId,
      unbReceiverId: partner.unbReceiverId,
    };

    let doc: EdiDocument | null = null;

    // ── Build document from DB records ─────────────────────────────────────
    const isX12     = partner.standard === "X12";
    const canonical = isX12 ? docType : docType; // both use same type string internally

    if (docType === "810" || docType === "INVOIC") {
      if (!sourceId) return NextResponse.json({ error: "sourceId (invoiceId) required for 810/INVOIC" }, { status: 400 });
      const inv = await prisma.invoice.findUnique({ where: { id: sourceId } });
      if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

      const itemsArr: any[] = Array.isArray(inv.items) ? inv.items : [];
      const lines: EdiLineItem[] = itemsArr.map((it: any, i: number) => ({
        lineNumber:  i + 1,
        sku:         it.sku        ?? "",
        description: it.name       ?? it.description ?? "",
        qty:         Number(it.qty ?? it.quantity ?? 1),
        unitPrice:   Number(it.unitPrice ?? it.price ?? 0),
        uom:         it.uom        ?? "EA",
        lineTotal:   Number(it.lineTotal ?? (it.qty ?? 1) * (it.unitPrice ?? 0)),
      }));

      doc = {
        type:          "Invoice",
        standard:      cfg.standard,
        controlNumber: "",
        invoiceNumber: inv.invoiceNumber,
        invoiceDate:   inv.issueDate,
        dueDate:       inv.dueDate,
        poNumber:      "",
        buyerParty:    { id: "", name: inv.customer, address1: "", city: "", state: "", zip: "", country: "" },
        vendorParty:   emptyParty(),
        paymentTerms:  inv.paymentTerms,
        currency:      inv.currency,
        lines,
        subtotal:      inv.subtotal,
        taxAmt:        inv.tax,
        totalAmt:      inv.total,
      };
    }

    if (docType === "855" || docType === "ORDRSP") {
      if (!sourceId) return NextResponse.json({ error: "sourceId (purchaseOrderId) required" }, { status: 400 });
      const po = await prisma.purchaseOrder.findUnique({ where: { id: sourceId } });
      if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

      const itemsArr: any[] = Array.isArray(po.items) ? po.items : [];
      const lines: EdiLineItem[] = itemsArr.map((it: any, i: number) => ({
        lineNumber:  i + 1,
        sku:         it.sku ?? "",
        description: it.name ?? "",
        qty:         Number(it.qty ?? 0),
        unitPrice:   Number(it.unitPrice ?? 0),
        uom:         "EA",
        lineTotal:   Number(it.qty ?? 0) * Number(it.unitPrice ?? 0),
      }));

      doc = {
        type:          "PoAck",
        standard:      cfg.standard,
        controlNumber: "",
        poNumber:      po.poNumber,
        ackDate:       new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        status:        po.status === "approved" ? "accepted" : po.status === "rejected" ? "rejected" : "accepted",
        lines,
        notes:         po.notes,
      };
    }

    if (docType === "856" || docType === "DESADV") {
      if (!sourceId) return NextResponse.json({ error: "sourceId (shipmentId) required" }, { status: 400 });
      const ship = await prisma.shipment.findUnique({ where: { id: sourceId } });
      if (!ship) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

      doc = {
        type:          "ASN",
        standard:      cfg.standard,
        controlNumber: "",
        shipmentId:    ship.shipmentNumber,
        shipDate:      ship.createdAt.toISOString().slice(0, 10).replace(/-/g, ""),
        carrier:       ship.carrier,
        trackingNumber:ship.trackingNumber,
        poNumber:      ship.orderId ?? "",
        lines:         [],
      };
    }

    if (!doc) {
      return NextResponse.json({ error: `Unsupported docType: ${docType}` }, { status: 400 });
    }

    // Generate EDI text
    const rawPayload = isX12 ? generateX12(doc, cfg) : generateEdifact(doc, cfg);

    // Store transaction
    const txSet = docType;
    const tx = await prisma.ediTransaction.create({
      data: {
        direction:     "outbound",
        standard:      cfg.standard,
        txSet,
        controlNumber: doc.controlNumber,
        partnerId,
        workspaceId,
        status:        "sent",
        rawPayload,
        parsedJson:    doc as any,
        errorMsg:      "",
      },
    });

    return NextResponse.json({
      transactionId: tx.id,
      txSet,
      standard: cfg.standard,
      rawPayload,
    });
  } catch (err: any) {
    console.error("EDI outbound error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
