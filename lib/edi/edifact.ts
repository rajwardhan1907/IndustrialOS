// lib/edi/edifact.ts — EDIFACT parser and generator (Phase 23)
// Supports: ORDERS (Purchase Order), ORDRSP (PO Response),
//           DESADV (Dispatch Advice / ASN), INVOIC (Invoice)

import {
  EdiDocument, EdiLineItem, EdiParty, EdiPartnerConfig,
  EdiPurchaseOrder, EdiInvoice, EdiPoAck, EdiAsn,
} from "./types";

// ── Tokeniser ─────────────────────────────────────────────────────────────────
interface EdifactSegment {
  tag:      string;
  elements: string[][];   // composite elements (split on component sep)
}

function tokenise(raw: string): EdifactSegment[] {
  const clean = raw.replace(/\r?\n/g, "").trim();

  // Detect delimiters from UNA service string advice (if present)
  let compSep = ":", elemSep = "+", decMark = ".", relChar = "?", segTerm = "'";
  if (clean.startsWith("UNA")) {
    compSep  = clean[3];
    elemSep  = clean[4];
    decMark  = clean[5];
    relChar  = clean[6];
    segTerm  = clean[8];
  }

  const text = clean.startsWith("UNA") ? clean.slice(9) : clean;
  const segments: EdifactSegment[] = [];

  let buf = "", inRelease = false;
  const chars = text.split("");
  for (const ch of chars) {
    if (inRelease) { buf += ch; inRelease = false; continue; }
    if (ch === relChar) { inRelease = true; continue; }
    if (ch === segTerm) {
      const s = buf.trim();
      if (s) {
        const parts = s.split(elemSep);
        segments.push({
          tag:      parts[0],
          elements: parts.slice(1).map(e => e.split(compSep)),
        });
      }
      buf = "";
    } else {
      buf += ch;
    }
  }
  return segments;
}

function el(seg: EdifactSegment, elemIdx: number, compIdx = 0): string {
  return ((seg.elements[elemIdx - 1] ?? [])[compIdx] ?? "").trim();
}

// ── Parser ────────────────────────────────────────────────────────────────────
export function parseEdifact(raw: string): EdiDocument {
  const segs = tokenise(raw);
  const unh  = segs.find(s => s.tag === "UNH");
  if (!unh) throw new Error("No UNH segment found");
  const msgType = el(unh, 2, 0);   // e.g. ORDERS, INVOIC
  const ctrl    = el(unh, 1);

  const unbCtrl = (() => {
    const unb = segs.find(s => s.tag === "UNB");
    return unb ? el(unb, 5) : ctrl;
  })();

  switch (msgType) {
    case "ORDERS": return parseOrders(segs, unbCtrl);
    case "ORDRSP": return parseOrdrsp(segs, unbCtrl);
    case "DESADV": return parseDesadv(segs, unbCtrl);
    case "INVOIC": return parseInvoic(segs, unbCtrl);
    default: throw new Error(`Unsupported EDIFACT message type: ${msgType}`);
  }
}

function nadToParty(seg: EdifactSegment): EdiParty {
  return {
    id:       el(seg, 2, 0),
    name:     el(seg, 4, 0) || el(seg, 3, 0),
    address1: el(seg, 5, 0),
    city:     el(seg, 6, 0),
    state:    el(seg, 7, 0),
    zip:      el(seg, 8, 0),
    country:  el(seg, 9, 0) || "US",
  };
}

function emptyParty(): EdiParty {
  return { id: "", name: "", address1: "", city: "", state: "", zip: "", country: "" };
}

function parseOrders(segs: EdifactSegment[], ctrl: string): EdiPurchaseOrder {
  const bgm    = segs.find(s => s.tag === "BGM");
  const dtm    = segs.find(s => s.tag === "DTM" && el(s, 1, 0) === "137");
  const dtmDel = segs.find(s => s.tag === "DTM" && el(s, 1, 0) === "2");
  const cur    = segs.find(s => s.tag === "CUX");
  const pay    = segs.find(s => s.tag === "PAY" || s.tag === "PAI");

  const nads   = segs.filter(s => s.tag === "NAD");
  const buyer  = nads.find(s => el(s, 1) === "BY") ?? nads[0];
  const vendor = nads.find(s => el(s, 1) === "SU") ?? nads[1];
  const ship   = nads.find(s => el(s, 1) === "DP") ?? nads[2];

  const lines: EdiLineItem[] = [];
  segs.forEach((seg, i) => {
    if (seg.tag !== "LIN") return;
    const pia = segs.slice(i + 1).find(s => s.tag === "PIA" || s.tag === "IMD");
    const qty = segs.slice(i + 1).find(s => s.tag === "QTY" && el(s, 1, 0) === "21");
    const pri = segs.slice(i + 1).find(s => s.tag === "PRI");
    const qtyVal  = qty ? parseFloat(el(qty, 1, 1)) || 0 : 0;
    const priceVal = pri ? parseFloat(el(pri, 1, 1)) || 0 : 0;
    lines.push({
      lineNumber:  lines.length + 1,
      sku:         el(seg, 2, 0) || (pia ? el(pia, 2, 0) : ""),
      description: pia && pia.tag === "IMD" ? el(pia, 3, 4) : "",
      qty:         qtyVal,
      unitPrice:   priceVal,
      uom:         qty ? el(qty, 1, 2) || "EA" : "EA",
      lineTotal:   qtyVal * priceVal,
    });
  });

  const totalValue = lines.reduce((a, l) => a + l.lineTotal, 0);

  return {
    type:          "PurchaseOrder",
    standard:      "EDIFACT",
    controlNumber: ctrl,
    poNumber:      bgm ? el(bgm, 2) : "",
    poDate:        dtm ? el(dtm, 1, 1) : "",
    requestedDate: dtmDel ? el(dtmDel, 1, 1) : "",
    buyerParty:    buyer  ? nadToParty(buyer)  : emptyParty(),
    vendorParty:   vendor ? nadToParty(vendor) : emptyParty(),
    shipToParty:   ship   ? nadToParty(ship)   : emptyParty(),
    paymentTerms:  pay ? el(pay, 1, 0) || "Net 30" : "Net 30",
    currency:      cur ? el(cur, 1, 0) : "USD",
    lines,
    totalValue,
    notes:         "",
  };
}

function parseOrdrsp(segs: EdifactSegment[], ctrl: string): EdiPoAck {
  const bgm = segs.find(s => s.tag === "BGM");
  const dtm = segs.find(s => s.tag === "DTM" && el(s, 1, 0) === "137");
  const rff = segs.find(s => s.tag === "RFF" && el(s, 1, 0) === "ON");

  // BGM qualifier: 105=accepted 106=rejected other=changed
  const qual  = bgm ? el(bgm, 1, 0) : "";
  const status: EdiPoAck["status"] = qual === "105" ? "accepted" : qual === "106" ? "rejected" : "changed";

  const lines: EdiLineItem[] = [];
  segs.forEach((seg, i) => {
    if (seg.tag !== "LIN") return;
    const qty = segs.slice(i + 1).find(s => s.tag === "QTY");
    const qtyVal = qty ? parseFloat(el(qty, 1, 1)) || 0 : 0;
    lines.push({
      lineNumber:  lines.length + 1,
      sku:         el(seg, 2, 0),
      description: "",
      qty:         qtyVal,
      unitPrice:   0,
      uom:         qty ? el(qty, 1, 2) || "EA" : "EA",
      lineTotal:   0,
    });
  });

  return {
    type:          "PoAck",
    standard:      "EDIFACT",
    controlNumber: ctrl,
    poNumber:      rff ? el(rff, 1, 1) : "",
    ackDate:       dtm ? el(dtm, 1, 1) : "",
    status,
    lines,
    notes:         "",
  };
}

function parseDesadv(segs: EdifactSegment[], ctrl: string): EdiAsn {
  const bgm  = segs.find(s => s.tag === "BGM");
  const dtm  = segs.find(s => s.tag === "DTM");
  const rff  = segs.find(s => s.tag === "RFF" && el(s, 1, 0) === "ON");
  const tdt  = segs.find(s => s.tag === "TDT");

  const lines: EdiLineItem[] = [];
  segs.forEach((seg, i) => {
    if (seg.tag !== "LIN") return;
    const qty = segs.slice(i + 1).find(s => s.tag === "QTY");
    const qtyVal = qty ? parseFloat(el(qty, 1, 1)) || 0 : 0;
    lines.push({
      lineNumber:  lines.length + 1,
      sku:         el(seg, 2, 0),
      description: "",
      qty:         qtyVal,
      unitPrice:   0,
      uom:         "EA",
      lineTotal:   0,
    });
  });

  return {
    type:          "ASN",
    standard:      "EDIFACT",
    controlNumber: ctrl,
    shipmentId:    bgm ? el(bgm, 2) : "",
    shipDate:      dtm ? el(dtm, 1, 1) : "",
    carrier:       tdt ? el(tdt, 3, 0) : "",
    trackingNumber:tdt ? el(tdt, 4, 0) : "",
    poNumber:      rff ? el(rff, 1, 1) : "",
    lines,
  };
}

function parseInvoic(segs: EdifactSegment[], ctrl: string): EdiInvoice {
  const bgm   = segs.find(s => s.tag === "BGM");
  const dtm1  = segs.find(s => s.tag === "DTM" && el(s, 1, 0) === "137");
  const dtm2  = segs.find(s => s.tag === "DTM" && el(s, 1, 0) === "13");
  const cur   = segs.find(s => s.tag === "CUX");
  const rff   = segs.find(s => s.tag === "RFF" && el(s, 1, 0) === "ON");
  const pay   = segs.find(s => s.tag === "PAI");
  const moaTot = segs.find(s => s.tag === "MOA" && el(s, 1, 0) === "86");
  const moaTax = segs.find(s => s.tag === "TAX");

  const nads   = segs.filter(s => s.tag === "NAD");
  const vendor = nads.find(s => el(s, 1) === "SU") ?? nads[0];
  const buyer  = nads.find(s => el(s, 1) === "BY") ?? nads[1];

  const lines: EdiLineItem[] = [];
  segs.forEach((seg, i) => {
    if (seg.tag !== "LIN") return;
    const qty = segs.slice(i + 1).find(s => s.tag === "QTY" && el(s, 1, 0) === "47");
    const pri = segs.slice(i + 1).find(s => s.tag === "PRI");
    const qtyVal   = qty ? parseFloat(el(qty, 1, 1)) || 0 : 0;
    const priceVal = pri ? parseFloat(el(pri, 1, 1)) || 0 : 0;
    lines.push({
      lineNumber:  lines.length + 1,
      sku:         el(seg, 2, 0),
      description: "",
      qty:         qtyVal,
      unitPrice:   priceVal,
      uom:         qty ? el(qty, 1, 2) || "EA" : "EA",
      lineTotal:   qtyVal * priceVal,
    });
  });

  const subtotal = moaTot ? parseFloat(el(moaTot, 1, 1)) || lines.reduce((a, l) => a + l.lineTotal, 0) : lines.reduce((a, l) => a + l.lineTotal, 0);
  const taxAmt   = moaTax ? parseFloat(el(moaTax, 3, 0)) || 0 : 0;

  return {
    type:          "Invoice",
    standard:      "EDIFACT",
    controlNumber: ctrl,
    invoiceNumber: bgm ? el(bgm, 2) : "",
    invoiceDate:   dtm1 ? el(dtm1, 1, 1) : "",
    dueDate:       dtm2 ? el(dtm2, 1, 1) : "",
    poNumber:      rff  ? el(rff, 1, 1)  : "",
    buyerParty:    buyer  ? nadToParty(buyer)  : emptyParty(),
    vendorParty:   vendor ? nadToParty(vendor) : emptyParty(),
    paymentTerms:  pay ? el(pay, 1, 0) || "Net 30" : "Net 30",
    currency:      cur ? el(cur, 1, 0) : "USD",
    lines,
    subtotal,
    taxAmt,
    totalAmt: subtotal + taxAmt,
  };
}

// ── Generator ─────────────────────────────────────────────────────────────────
const C = ":";   // component sep
const E = "+";   // element sep
const S = "'";   // segment terminator

function today(): string { return new Date().toISOString().slice(0, 10).replace(/-/g, ""); }
function nowTime(): string { return new Date().toTimeString().slice(0, 5).replace(":", ""); }
function ctrl(): string { return String(Math.floor(Math.random() * 9000000) + 1000000); }

function una(): string { return `UNA:+.? '`; }
function unb(sender: string, receiver: string, ref: string): string {
  return `UNB+UNOA:4+${sender}+${receiver}+${today()}:${nowTime()}+${ref}'`;
}
function unh(ref: string, msgType: string): string {
  return `UNH+${ref}+${msgType}:D:96A:UN'`;
}
function unt(segCount: number, ref: string): string { return `UNT+${segCount}+${ref}'`; }
function unz(msgCount: number, ref: string): string { return `UNZ+${msgCount}+${ref}'`; }

function nadSeg(qualifier: string, party: EdiParty): string {
  return `NAD+${qualifier}+${party.id}::92++${party.name}+${party.address1}+${party.city}+${party.state}+${party.zip}+${party.country}'`;
}

export function generateEdifact(doc: EdiDocument, cfg: EdiPartnerConfig): string {
  switch (doc.type) {
    case "PurchaseOrder": return generateOrders(doc, cfg);
    case "Invoice":       return generateInvoic(doc, cfg);
    case "PoAck":         return generateOrdrsp(doc, cfg);
    case "ASN":           return generateDesadv(doc, cfg);
  }
}

function generateOrders(doc: EdiPurchaseOrder, cfg: EdiPartnerConfig): string {
  const ref = ctrl();
  const segs: string[] = [];
  segs.push(una());
  segs.push(unb(cfg.unbSenderId || "SENDER", cfg.unbReceiverId || "PARTNER", ref));
  segs.push(unh(ref, "ORDERS"));
  segs.push(`BGM+220+${doc.poNumber}+9'`);
  segs.push(`DTM+137:${doc.poDate}:102'`);
  if (doc.requestedDate) segs.push(`DTM+2:${doc.requestedDate}:102'`);
  segs.push(`CUX+2:${doc.currency}:9'`);
  segs.push(nadSeg("BY", doc.buyerParty));
  segs.push(nadSeg("SU", doc.vendorParty));
  segs.push(nadSeg("DP", doc.shipToParty));
  doc.lines.forEach((line, i) => {
    segs.push(`LIN+${i + 1}++${line.sku}:SA'`);
    segs.push(`IMD+F++:::${line.description}'`);
    segs.push(`QTY+21:${line.qty}:EA'`);
    segs.push(`PRI+AAB:${line.unitPrice.toFixed(2)}:CT'`);
    segs.push(`MOA+203:${line.lineTotal.toFixed(2)}'`);
  });
  segs.push(`UNS+S'`);
  segs.push(`CNT+2:${doc.lines.length}'`);
  segs.push(`MOA+86:${doc.totalValue.toFixed(2)}'`);
  segs.push(unt(segs.length - 2, ref)); // subtract UNA + UNB
  segs.push(unz(1, ref));
  return segs.join("\n");
}

function generateOrdrsp(doc: EdiPoAck, cfg: EdiPartnerConfig): string {
  const ref = ctrl();
  const qual = doc.status === "accepted" ? "105" : doc.status === "rejected" ? "106" : "107";
  const segs: string[] = [];
  segs.push(una());
  segs.push(unb(cfg.unbSenderId || "SENDER", cfg.unbReceiverId || "PARTNER", ref));
  segs.push(unh(ref, "ORDRSP"));
  segs.push(`BGM+${qual}+${doc.poNumber}+9'`);
  segs.push(`DTM+137:${doc.ackDate || today()}:102'`);
  segs.push(`RFF+ON:${doc.poNumber}'`);
  doc.lines.forEach((line, i) => {
    segs.push(`LIN+${i + 1}++${line.sku}:SA'`);
    segs.push(`QTY+21:${line.qty}:EA'`);
  });
  segs.push(unt(segs.length - 2, ref));
  segs.push(unz(1, ref));
  return segs.join("\n");
}

function generateDesadv(doc: EdiAsn, cfg: EdiPartnerConfig): string {
  const ref = ctrl();
  const segs: string[] = [];
  segs.push(una());
  segs.push(unb(cfg.unbSenderId || "SENDER", cfg.unbReceiverId || "PARTNER", ref));
  segs.push(unh(ref, "DESADV"));
  segs.push(`BGM+351+${doc.shipmentId}+9'`);
  segs.push(`DTM+137:${doc.shipDate || today()}:102'`);
  segs.push(`RFF+ON:${doc.poNumber}'`);
  if (doc.carrier || doc.trackingNumber) segs.push(`TDT+20+++++${doc.carrier || ""}:${doc.trackingNumber || ""}'`);
  doc.lines.forEach((line, i) => {
    segs.push(`LIN+${i + 1}++${line.sku}:SA'`);
    segs.push(`QTY+12:${line.qty}:EA'`);
  });
  segs.push(unt(segs.length - 2, ref));
  segs.push(unz(1, ref));
  return segs.join("\n");
}

function generateInvoic(doc: EdiInvoice, cfg: EdiPartnerConfig): string {
  const ref = ctrl();
  const segs: string[] = [];
  segs.push(una());
  segs.push(unb(cfg.unbSenderId || "SENDER", cfg.unbReceiverId || "PARTNER", ref));
  segs.push(unh(ref, "INVOIC"));
  segs.push(`BGM+380+${doc.invoiceNumber}+9'`);
  segs.push(`DTM+137:${doc.invoiceDate}:102'`);
  if (doc.dueDate) segs.push(`DTM+13:${doc.dueDate}:102'`);
  segs.push(`RFF+ON:${doc.poNumber}'`);
  segs.push(`CUX+2:${doc.currency}:9'`);
  segs.push(nadSeg("SU", doc.vendorParty));
  segs.push(nadSeg("BY", doc.buyerParty));
  doc.lines.forEach((line, i) => {
    segs.push(`LIN+${i + 1}++${line.sku}:SA'`);
    segs.push(`QTY+47:${line.qty}:EA'`);
    segs.push(`PRI+AAB:${line.unitPrice.toFixed(2)}:CT'`);
    segs.push(`MOA+203:${line.lineTotal.toFixed(2)}'`);
  });
  segs.push(`UNS+S'`);
  if (doc.taxAmt > 0) segs.push(`TAX+7+VAT+++:::${((doc.taxAmt / doc.subtotal) * 100).toFixed(0)}+S'`);
  segs.push(`MOA+86:${doc.totalAmt.toFixed(2)}'`);
  segs.push(unt(segs.length - 2, ref));
  segs.push(unz(1, ref));
  return segs.join("\n");
}
