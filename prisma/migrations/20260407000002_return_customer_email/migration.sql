-- Add customerEmail column to Return table for customer portal submissions
ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT NOT NULL DEFAULT '';
