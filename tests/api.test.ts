import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// ── Shared test workspace ──────────────────────────────────────────────────
let workspaceId: string;
let userId: string;

beforeAll(async () => {
  // Create a fresh isolated workspace for all tests
  const ws = await prisma.workspace.create({
    data: { name: "Test Workspace", industry: "Testing" },
  });
  workspaceId = ws.id;

  const user = await prisma.user.create({
    data: {
      name: "Test Admin",
      email: `testadmin_${Date.now()}@test.com`,
      password: await bcrypt.hash("test1234", 10),
      role: "admin",
      workspaceId,
    },
  });
  userId = user.id;
});

afterAll(async () => {
  // Clean up everything created during tests
  await prisma.ticketComment.deleteMany({ where: { ticket: { workspaceId } } });
  await prisma.ticket.deleteMany({ where: { workspaceId } });
  await prisma.notification.deleteMany({ where: { workspaceId } });
  await prisma.invoice.deleteMany({ where: { workspaceId } });
  await prisma.order.deleteMany({ where: { workspaceId } });
  await prisma.inventoryItem.deleteMany({ where: { workspaceId } });
  await prisma.user.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });
  await prisma.$disconnect();
});

const BASE = "http://localhost:3000";

// ── 1. GET /api/orders ─────────────────────────────────────────────────────
describe("GET /api/orders", () => {
  it("returns 400 if workspaceId is missing", async () => {
    const res = await fetch(`${BASE}/api/orders`);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns an array for a valid workspaceId", async () => {
    const res = await fetch(`${BASE}/api/orders?workspaceId=${workspaceId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

// ── 2. POST /api/orders ────────────────────────────────────────────────────
describe("POST /api/orders", () => {
  it("creates an order and returns it", async () => {
    const res = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        customer: "Test Customer",
        sku: "TEST-SKU-001",
        items: 5,
        value: 250,
        priority: "MED",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.customer).toBe("Test Customer");
    expect(json.stage).toBe("Placed");
  });
});

// ── 3. GET /api/inventory ──────────────────────────────────────────────────
describe("GET /api/inventory", () => {
  it("returns 400 if workspaceId is missing", async () => {
    const res = await fetch(`${BASE}/api/inventory`);
    expect(res.status).toBe(400);
  });

  it("returns an array for a valid workspaceId", async () => {
    const res = await fetch(`${BASE}/api/inventory?workspaceId=${workspaceId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

// ── 4. POST /api/invoices ──────────────────────────────────────────────────
describe("POST /api/invoices", () => {
  it("creates an invoice and returns it", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`${BASE}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        customer: "Test Customer",
        items: [{ description: "Widget", qty: 2, unitPrice: 100, total: 200 }],
        subtotal: 200,
        tax: 18,
        total: 218,
        amountPaid: 0,
        paymentTerms: "Net 30",
        issueDate: today,
        dueDate: today,
        status: "unpaid",
        currency: "USD",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.status).toBe("unpaid");
    expect(json.total).toBe(218);
  });
});

// ── 5. GET /api/dashboard ──────────────────────────────────────────────────
describe("GET /api/dashboard", () => {
  it("returns dashboard stats object", async () => {
    const res = await fetch(`${BASE}/api/dashboard?workspaceId=${workspaceId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("totalOrders");
    expect(json).toHaveProperty("totalRevenue");
  });
});

// ── 6. GET /api/notifications ──────────────────────────────────────────────
describe("GET /api/notifications", () => {
  it("returns notifications array", async () => {
    const res = await fetch(`${BASE}/api/notifications?workspaceId=${workspaceId}`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });
});

// ── 7. POST /api/tickets ───────────────────────────────────────────────────
describe("POST /api/tickets", () => {
  it("creates a ticket and returns it", async () => {
    const res = await fetch(`${BASE}/api/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        title: "Test ticket",
        description: "Created by automated test",
        type: "issue",
        priority: "medium",
        raisedBy: userId,
        raisedName: "Test Admin",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.title).toBe("Test ticket");
    expect(json.status).toBe("open");
  });
});

// ── 8. POST /api/register ──────────────────────────────────────────────────
describe("POST /api/register", () => {
  it("rejects registration with a short password", async () => {
    const res = await fetch(`${BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Test Co",
        industry: "Testing",
        name: "New User",
        email: `newuser_${Date.now()}@test.com`,
        password: "123",
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/password/i);
  });
});
