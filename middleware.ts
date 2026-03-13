import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protect everything EXCEPT these public routes
  matcher: [
    "/((?!login|portal|api/auth|_next/static|_next/image|favicon.ico|icon-|manifest.json|robots.txt).*)",
  ],
};
