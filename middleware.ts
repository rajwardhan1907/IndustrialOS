import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/((?!login|register|portal|api/auth|api/register|_next/static|_next/image|favicon.ico).*)",
  ],
};
