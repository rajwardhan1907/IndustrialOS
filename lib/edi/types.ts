// lib/edi/types.ts — Shared EDI types (Phase 23)

export type EdiStandard = "X12" | "EDIFACT";
export type EdiDirection = "inbound" | "outbound";

// ── Generic line item used in all transaction types ───────────────────────────
export interface EdiLineItem {
  lineNumber:   number;
  sku:          string;
  description:  string;
  qty:          number;
  unitPrice:    number;
  uom:          string;   // unit of measure, e.g. "EA", "CS"
  lineTotal:    number;
}

// ── Parsed Purchase Order (X12 850 / EDIFACT ORDERS) ─────────────────────────
export interface EdiPurchaseOrder {
  type:            "PurchaseOrder";
  standard:        EdiStandard;
  controlNumber:   string;
  poNumber:        string;
  poDate:          string;   // YYYYMMDD
  requestedDate:   string;
  buyerParty:      EdiParty;
  vendorParty:     EdiParty;
  shipToParty:     EdiParty;
  paymentTerms:    string;
  currency:        string;
  lines:           EdiLineItem[];
  totalValue:      number;
  notes:           string;
}

// ── Parsed Invoice (X12 810 / EDIFACT INVOIC) ─────────────────────────────────
export interface EdiInvoice {
  type:          "Invoice";
  standard:      EdiStandard;
  controlNumber: string;
  invoiceNumber: string;
  invoiceDate:   string;
  dueDate:       string;
  poNumber:      string;
  buyerParty:    EdiParty;
  vendorParty:   EdiParty;
  paymentTerms:  string;
  currency:      string;
  lines:         EdiLineItem[];
  subtotal:      number;
  taxAmt:        number;
  totalAmt:      number;
}

// ── Parsed PO Acknowledgment (X12 855 / EDIFACT ORDRSP) ──────────────────────
export interface EdiPoAck {
  type:          "PoAck";
  standard:      EdiStandard;
  controlNumber: string;
  poNumber:      string;
  ackDate:       string;
  status:        "accepted" | "rejected" | "changed";
  lines:         EdiLineItem[];
  notes:         string;
}

// ── Parsed Advance Ship Notice (X12 856 / EDIFACT DESADV) ────────────────────
export interface EdiAsn {
  type:          "ASN";
  standard:      EdiStandard;
  controlNumber: string;
  shipmentId:    string;
  shipDate:      string;
  carrier:       string;
  trackingNumber:string;
  poNumber:      string;
  lines:         EdiLineItem[];
}

export interface EdiParty {
  id:       string;
  name:     string;
  address1: string;
  city:     string;
  state:    string;
  zip:      string;
  country:  string;
}

export type EdiDocument =
  | EdiPurchaseOrder
  | EdiInvoice
  | EdiPoAck
  | EdiAsn;

// ── Trading partner config used when generating outbound EDI ──────────────────
export interface EdiPartnerConfig {
  standard:      EdiStandard;
  isaQualifier:  string;
  isaId:         string;
  partnerQual:   string;
  partnerId:     string;
  unbSenderId:   string;
  unbReceiverId: string;
}
