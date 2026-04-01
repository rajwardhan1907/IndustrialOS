// lib/edi/x12.ts — X12 EDI parser and generator (Phase 23)
// Supports: 850 (Purchase Order), 855 (PO Acknowledgment),
//           856 (Advance Ship Notice), 810 (Invoice)

import {
  EdiDocument, EdiLineItem, EdiParty, EdiPartnerConfig,
  EdiPurchaseOrder, EdiInvoice, EdiPoAck, EdiAsn,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(str: string, len: number, char = " "): string {
  return str.substring(0, len).padEnd(len, char);
}
function today(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
function nowTime(): string {
  return new Date().toTimeString().slice(0, 5).replace(":", "");
}
function nextControlNumber(): string {
  return String(Math.floor(Math.random() * 900000000) + 100000000).substring(0, 9);
}

// ── Tokeniser: split EDI text into segments and elements ─────────────────────
interface X12Segment {
  id:       string;
  elements: string[];
}

function tokenise(raw: string): X12Segment[] {
  // Detect delimiters from ISA header (fixed length)
  const clean = raw.replace(/\r?\n/g, "").trim();
  if (clean.length < 106) throw new Error("EDI too short to be valid X12");
  const elemSep = clean[3];   // position 3 of ISA header
  const segTerm = clean[105]; // position 105 of ISA header
  const segs = clean.split(segTerm).map(s => s.trim()).filter(Boolean);
  return segs.map(s => {
    const parts = s.split(elemSep);
    return { id: parts[0].trim(), elements: parts.slice(1) };
  });
}

function el(seg: X12Segment, idx: number): string {
  return (seg.elements[idx - 1] ?? "").trim();
}

// ── Parser ────────────────────────────────────────────────────────────────────
export function parseX12(raw: string): EdiDocument {
  const segs = tokenise(raw);

  // Find the transaction set header (ST segment)
  const st = segs.find(s => s.id === "ST");
  if (!st) throw new Error("No ST segment found");
  const txSet = el(st, 1);

  const ctrl = (() => {
    const gs = segs.find(s => s.id === "GS");
    return gs ? el(gs, 6) : "000000000";
  })();

  switch (txSet) {
    case "850": return parse850(segs, ctrl);
    case "855": return parse855(segs, ctrl);
    case "856": return parse856(segs, ctrl);
    case "810": return parse810(segs, ctrl);
    default:    throw new Error(`Unsupported X12 transaction set: ${txSet}`);
  }
}

function parseParty(seg: X12Segment): EdiParty {
  return {
    id:       el(seg, 2),
    name:     el(seg, 4),
    address1: el(seg, 5),
    city:     el(seg, 6),
    state:    el(seg, 7),
    zip:      el(seg, 8),
    country:  el(seg, 9) || "US",
  };
}

function parse850(segs: X12Segment[], ctrl: string): EdiPurchaseOrder {
  const beg  = segs.find(s => s.id === "BEG");
  const dtm  = segs.find(s => s.id === "DTM" && el(s, 1) === "002");
  const curr = segs.find(s => s.id === "CUR");

  const n1s = segs.filter(s => s.id === "N1");
  const buyer  = n1s.find(s => el(s, 1) === "BY") ?? n1s[0];
  const vendor = n1s.find(s => el(s, 1) === "SE") ?? n1s[1];
  const ship   = n1s.find(s => el(s, 1) === "ST") ?? n1s[2];

  const po1s = segs.filter(s => s.id === "PO1");
  const lines: EdiLineItem[] = po1s.map((s, i) => {
    const qty   = parseFloat(el(s, 2)) || 0;
    const price = parseFloat(el(s, 4)) || 0;
    return {
      lineNumber:  i + 1,
      sku:         el(s, 7) || el(s, 9) || "",
      description: "",
      qty,
      unitPrice:   price,
      uom:         el(s, 3) || "EA",
      lineTotal:   qty * price,
    };
  });

  // Pick up PID segments for descriptions
  const pids = segs.filter(s => s.id === "PID");
  pids.forEach((pid, i) => { if (lines[i]) lines[i].description = el(pid, 5); });

  const totalValue = lines.reduce((a, l) => a + l.lineTotal, 0);
  const itr = segs.find(s => s.id === "ITD");

  return {
    type:          "PurchaseOrder",
    standard:      "X12",
    controlNumber: ctrl,
    poNumber:      beg ? el(beg, 3) : "",
    poDate:        beg ? el(beg, 5) : "",
    requestedDate: dtm ? el(dtm, 2) : "",
    buyerParty:    buyer  ? parseParty(buyer)  : emptyParty(),
    vendorParty:   vendor ? parseParty(vendor) : emptyParty(),
    shipToParty:   ship   ? parseParty(ship)   : emptyParty(),
    paymentTerms:  itr ? el(itr, 3) || "Net 30" : "Net 30",
    currency:      curr ? el(curr, 2) : "USD",
    lines,
    totalValue,
    notes:         "",
  };
}

function parse855(segs: X12Segment[], ctrl: string): EdiPoAck {
  const bak   = segs.find(s => s.id === "BAK");
  const statusCode = bak ? el(bak, 2) : "IA";
  const status: EdiPoAck["status"] =
    statusCode === "IA" ? "accepted"
    : statusCode === "RD" ? "rejected"
    : "changed";

  const ack1s = segs.filter(s => s.id === "ACK");
  const lines: EdiLineItem[] = ack1s.map((s, i) => ({
    lineNumber:  i + 1,
    sku:         el(s, 7) || "",
    description: "",
    qty:         parseFloat(el(s, 2)) || 0,
    unitPrice:   0,
    uom:         el(s, 4) || "EA",
    lineTotal:   0,
  }));

  return {
    type:          "PoAck",
    standard:      "X12",
    controlNumber: ctrl,
    poNumber:      bak ? el(bak, 3) : "",
    ackDate:       bak ? el(bak, 4) : "",
    status,
    lines,
    notes:         "",
  };
}

function parse856(segs: X12Segment[], ctrl: string): EdiAsn {
  const bsn     = segs.find(s => s.id === "BSN");
  const td5     = segs.find(s => s.id === "TD5");
  const td3     = segs.find(s => s.id === "TD3");
  const ref     = segs.find(s => s.id === "REF" && el(s, 1) === "BM");

  const hl3s = segs.filter(s => s.id === "LIN");
  const sn1s = segs.filter(s => s.id === "SN1");
  const lines: EdiLineItem[] = hl3s.map((lin, i) => {
    const sn1 = sn1s[i];
    const qty = sn1 ? parseFloat(el(sn1, 2)) || 0 : 0;
    return {
      lineNumber:  i + 1,
      sku:         el(lin, 3) || "",
      description: el(lin, 5) || "",
      qty,
      unitPrice:   0,
      uom:         sn1 ? el(sn1, 3) || "EA" : "EA",
      lineTotal:   0,
    };
  });

  return {
    type:          "ASN",
    standard:      "X12",
    controlNumber: ctrl,
    shipmentId:    bsn ? el(bsn, 2) : "",
    shipDate:      bsn ? el(bsn, 3) : "",
    carrier:       td5 ? el(td5, 3) || el(td5, 2) : "",
    trackingNumber:td3 ? el(td3, 5) : "",
    poNumber:      ref ? el(ref, 2) : "",
    lines,
  };
}

function parse810(segs: X12Segment[], ctrl: string): EdiInvoice {
  const big  = segs.find(s => s.id === "BIG");
  const curr = segs.find(s => s.id === "CUR");
  const itd  = segs.find(s => s.id === "ITD");
  const tds  = segs.find(s => s.id === "TDS");
  const tax  = segs.find(s => s.id === "TXI");

  const n1s  = segs.filter(s => s.id === "N1");
  const buyer  = n1s.find(s => el(s, 1) === "BY") ?? n1s[0];
  const vendor = n1s.find(s => el(s, 1) === "SE") ?? n1s[1];

  const it1s = segs.filter(s => s.id === "IT1");
  const lines: EdiLineItem[] = it1s.map((s, i) => {
    const qty   = parseFloat(el(s, 2)) || 0;
    const price = parseFloat(el(s, 4)) || 0;
    return {
      lineNumber:  i + 1,
      sku:         el(s, 7) || el(s, 9) || "",
      description: "",
      qty,
      unitPrice:   price,
      uom:         el(s, 3) || "EA",
      lineTotal:   qty * price,
    };
  });

  const subtotal = parseFloat((tds ? el(tds, 1) : "0").replace(/\D/g, "")) / 100 || lines.reduce((a, l) => a + l.lineTotal, 0);
  const taxAmt   = tax ? parseFloat(el(tax, 2)) || 0 : 0;

  return {
    type:          "Invoice",
    standard:      "X12",
    controlNumber: ctrl,
    invoiceNumber: big ? el(big, 2) : "",
    invoiceDate:   big ? el(big, 1) : "",
    dueDate:       big ? el(big, 4) : "",
    poNumber:      big ? el(big, 3) : "",
    buyerParty:    buyer  ? parseParty(buyer)  : emptyParty(),
    vendorParty:   vendor ? parseParty(vendor) : emptyParty(),
    paymentTerms:  itd ? el(itd, 3) || "Net 30" : "Net 30",
    currency:      curr ? el(curr, 2) : "USD",
    lines,
    subtotal,
    taxAmt,
    totalAmt: subtotal + taxAmt,
  };
}

function emptyParty(): EdiParty {
  return { id: "", name: "", address1: "", city: "", state: "", zip: "", country: "" };
}

// ── Generator ──────────────────────────────────────────────────────────────────
export function generateX12(doc: EdiDocument, cfg: EdiPartnerConfig): string {
  switch (doc.type) {
    case "PurchaseOrder": return generate850(doc, cfg);
    case "Invoice":       return generate810(doc, cfg);
    case "PoAck":         return generate855(doc, cfg);
    case "ASN":           return generate856(doc, cfg);
  }
}

// Delimiters
const ELEM  = "*";
const COMP  = ">";
const SEG   = "~\n";

function isa(cfg: EdiPartnerConfig, icn: string): string {
  return [
    "ISA",
    cfg.isaQualifier || "01",
    pad("", 10),
    "00",
    pad("", 10),
    cfg.partnerQual || "01",
    pad(cfg.partnerId || "PARTNER", 15),
    cfg.isaQualifier || "01",
    pad(cfg.isaId    || "SENDER",  15),
    today().substring(2),
    nowTime(),
    "^",
    "00501",
    pad(icn, 9, "0"),
    "0",
    "P",
    ":",
  ].join(ELEM) + SEG;
}

function gs(funcId: string, sender: string, receiver: string, gcn: string): string {
  return ["GS", funcId, sender, receiver, today(), nowTime(), gcn, "X", "005010"].join(ELEM) + SEG;
}
function ge(txCount: number, gcn: string): string { return `GE${ELEM}${txCount}${ELEM}${gcn}${SEG}`; }
function iea(gsCount: number, icn: string): string { return `IEA${ELEM}${gsCount}${ELEM}${pad(icn, 9, "0")}${SEG}`; }

function partySegs(qualifier: string, party: EdiParty): string {
  return [
    ["N1", qualifier, party.name, "92", party.id].join(ELEM) + SEG,
    ["N3", party.address1].join(ELEM) + SEG,
    ["N4", party.city, party.state, party.zip, party.country].join(ELEM) + SEG,
  ].join("");
}

function generate850(doc: EdiPurchaseOrder, cfg: EdiPartnerConfig): string {
  const icn  = nextControlNumber();
  const gcn  = icn.substring(0, 9);
  const tscn = "0001";
  let out = "";
  out += isa(cfg, icn);
  out += gs("PO", cfg.isaId || "SENDER", cfg.partnerId || "PARTNER", gcn);
  out += `ST${ELEM}850${ELEM}${tscn}${SEG}`;
  out += `BEG${ELEM}00${ELEM}SA${ELEM}${doc.poNumber}${ELEM}${ELEM}${doc.poDate}${SEG}`;
  out += `CUR${ELEM}BY${ELEM}${doc.currency}${SEG}`;
  out += partySegs("BY", doc.buyerParty);
  out += partySegs("SE", doc.vendorParty);
  out += partySegs("ST", doc.shipToParty);
  doc.lines.forEach((line, i) => {
    const n = String(i + 1).padStart(4, "0");
    out += `PO1${ELEM}${n}${ELEM}${line.qty}${ELEM}${line.uom}${ELEM}${line.unitPrice.toFixed(2)}${ELEM}PE${ELEM}SK${ELEM}${line.sku}${SEG}`;
    if (line.description) out += `PID${ELEM}F${ELEM}${ELEM}${ELEM}${ELEM}${line.description}${SEG}`;
  });
  out += `CTT${ELEM}${doc.lines.length}${SEG}`;
  out += `AMT${ELEM}TT${ELEM}${doc.totalValue.toFixed(2)}${SEG}`;
  const segCount = out.split(SEG).filter(Boolean).length - 2; // subtract ISA + GS
  out += `SE${ELEM}${segCount + 2}${ELEM}${tscn}${SEG}`;
  out += ge(1, gcn);
  out += iea(1, icn);
  return out;
}

function generate855(doc: EdiPoAck, cfg: EdiPartnerConfig): string {
  const icn = nextControlNumber();
  const gcn = icn.substring(0, 9);
  const tscn = "0001";
  const statusCode = doc.status === "accepted" ? "IA" : doc.status === "rejected" ? "RD" : "IC";
  let out = "";
  out += isa(cfg, icn);
  out += gs("PR", cfg.isaId || "SENDER", cfg.partnerId || "PARTNER", gcn);
  out += `ST${ELEM}855${ELEM}${tscn}${SEG}`;
  out += `BAK${ELEM}00${ELEM}${statusCode}${ELEM}${doc.poNumber}${ELEM}${doc.ackDate || today()}${SEG}`;
  doc.lines.forEach((line, i) => {
    const n = String(i + 1).padStart(4, "0");
    out += `ACK${ELEM}${statusCode === "IA" ? "IA" : "IQ"}${ELEM}${line.qty}${ELEM}${line.uom}${ELEM}${ELEM}${ELEM}SK${ELEM}${line.sku}${SEG}`;
  });
  const segCount = out.split(SEG).filter(Boolean).length - 2;
  out += `SE${ELEM}${segCount + 2}${ELEM}${tscn}${SEG}`;
  out += ge(1, gcn);
  out += iea(1, icn);
  return out;
}

function generate856(doc: EdiAsn, cfg: EdiPartnerConfig): string {
  const icn = nextControlNumber();
  const gcn = icn.substring(0, 9);
  const tscn = "0001";
  let out = "";
  out += isa(cfg, icn);
  out += gs("SH", cfg.isaId || "SENDER", cfg.partnerId || "PARTNER", gcn);
  out += `ST${ELEM}856${ELEM}${tscn}${SEG}`;
  out += `BSN${ELEM}00${ELEM}${doc.shipmentId}${ELEM}${doc.shipDate || today()}${ELEM}${nowTime()}${SEG}`;
  out += `HL${ELEM}1${ELEM}${ELEM}S${SEG}`;
  if (doc.carrier) out += `TD5${ELEM}${ELEM}${ELEM}${doc.carrier}${SEG}`;
  if (doc.trackingNumber) out += `TD3${ELEM}${ELEM}${ELEM}${ELEM}${ELEM}${doc.trackingNumber}${SEG}`;
  if (doc.poNumber) out += `REF${ELEM}BM${ELEM}${doc.poNumber}${SEG}`;
  doc.lines.forEach((line, i) => {
    out += `HL${ELEM}${i + 2}${ELEM}1${ELEM}I${SEG}`;
    out += `LIN${ELEM}${ELEM}SK${ELEM}${line.sku}${ELEM}UP${ELEM}${line.description}${SEG}`;
    out += `SN1${ELEM}${ELEM}${line.qty}${ELEM}${line.uom}${SEG}`;
  });
  const segCount = out.split(SEG).filter(Boolean).length - 2;
  out += `SE${ELEM}${segCount + 2}${ELEM}${tscn}${SEG}`;
  out += ge(1, gcn);
  out += iea(1, icn);
  return out;
}

function generate810(doc: EdiInvoice, cfg: EdiPartnerConfig): string {
  const icn = nextControlNumber();
  const gcn = icn.substring(0, 9);
  const tscn = "0001";
  let out = "";
  out += isa(cfg, icn);
  out += gs("IN", cfg.isaId || "SENDER", cfg.partnerId || "PARTNER", gcn);
  out += `ST${ELEM}810${ELEM}${tscn}${SEG}`;
  out += `BIG${ELEM}${doc.invoiceDate}${ELEM}${doc.invoiceNumber}${ELEM}${doc.poNumber}${ELEM}${doc.dueDate}${SEG}`;
  out += `CUR${ELEM}SE${ELEM}${doc.currency}${SEG}`;
  out += partySegs("SE", doc.vendorParty);
  out += partySegs("BY", doc.buyerParty);
  doc.lines.forEach((line, i) => {
    const n = String(i + 1).padStart(4, "0");
    out += `IT1${ELEM}${n}${ELEM}${line.qty}${ELEM}${line.uom}${ELEM}${line.unitPrice.toFixed(2)}${ELEM}PE${ELEM}SK${ELEM}${line.sku}${SEG}`;
  });
  const totalCents = Math.round(doc.totalAmt * 100);
  out += `TDS${ELEM}${totalCents}${SEG}`;
  if (doc.taxAmt > 0) out += `TXI${ELEM}TX${ELEM}${doc.taxAmt.toFixed(2)}${ELEM}${ELEM}${ELEM}${ELEM}${ELEM}VA${SEG}`;
  out += `CTT${ELEM}${doc.lines.length}${SEG}`;
  const segCount = out.split(SEG).filter(Boolean).length - 2;
  out += `SE${ELEM}${segCount + 2}${ELEM}${tscn}${SEG}`;
  out += ge(1, gcn);
  out += iea(1, icn);
  return out;
}
