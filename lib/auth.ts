import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ── Demo fallback users (used when DB is unavailable or for demo accounts) ────
// These have no workspaceId — they only work with localStorage-based data
const DEMO_USERS = [
  { id: "demo-1", name: "Admin User",    email: "admin@demo.com",    password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", role: "admin"    },
  { id: "demo-2", name: "Operator User", email: "operator@demo.com", password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", role: "operator" },
  { id: "demo-3", name: "Viewer User",   email: "viewer@demo.com",   password: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", role: "viewer"   },
];

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages:   { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        // ── Step 1: Try real DB user first ──────────────────────────────
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email },
          });

          if (dbUser) {
            const valid = await bcrypt.compare(credentials.password, dbUser.password);
            if (!valid) return null;
            // Return full user with workspaceId — this goes into the JWT
            return {
              id:          dbUser.id,
              name:        dbUser.name,
              email:       dbUser.email,
              role:        dbUser.role,
              workspaceId: dbUser.workspaceId,
            };
          }
        } catch (err) {
          // DB is down or unreachable — fall through to demo users
          console.error("DB user lookup failed, falling back to demo users:", err);
        }

        // ── Step 2: Fall back to demo hardcoded users ────────────────────
        const demo = DEMO_USERS.find(u => u.email === email);
        if (!demo) return null;
        const valid = await bcrypt.compare(credentials.password, demo.password);
        if (!valid) return null;
        // Demo users have no workspaceId — they use localStorage only
        return {
          id:          demo.id,
          name:        demo.name,
          email:       demo.email,
          role:        demo.role,
          workspaceId: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign in, user is populated — copy fields into the token
      if (user) {
        token.role        = (user as any).role;
        token.workspaceId = (user as any).workspaceId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      // Every request — copy from token into the session object
      if (session.user) {
        (session.user as any).role        = token.role;
        (session.user as any).workspaceId = token.workspaceId ?? null;
      }
      return session;
    },
  },
};
