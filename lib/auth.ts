import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const USERS = [
  { id: "1", name: "Admin User",    email: "admin@demo.com",    password: "admin123",    role: "admin"    },
  { id: "2", name: "Operator User", email: "operator@demo.com", password: "operator123", role: "operator" },
  { id: "3", name: "Viewer User",   email: "viewer@demo.com",   password: "viewer123",   role: "viewer"   },
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
        const user = USERS.find(u => u.email === credentials.email.trim().toLowerCase());
        if (!user || credentials.password !== user.password) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
};
