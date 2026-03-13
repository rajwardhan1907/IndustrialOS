import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Demo users — replace with a real database later
const USERS = [
  { id: "1", name: "Admin User",    email: "admin@demo.com",    password: "admin123",    role: "admin",    org: "Acme Industrial Co." },
  { id: "2", name: "Operator User", email: "operator@demo.com", password: "operator123", role: "operator", org: "Acme Industrial Co." },
  { id: "3", name: "Viewer User",   email: "viewer@demo.com",   password: "viewer123",   role: "viewer",   org: "Acme Industrial Co." },
];

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = USERS.find(
          u => u.email === credentials.email.trim().toLowerCase()
        );

        if (!user) return null;
        if (credentials.password !== user.password) return null;

        return {
          id:   user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          org:  user.org,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.org  = (user as any).org;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).org  = token.org;
        (session.user as any).id   = token.sub;
      }
      return session;
    },
  },
};
