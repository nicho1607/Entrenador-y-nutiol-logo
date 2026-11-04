/**
 * Route protection middleware. Guards every app section that requires an
 * authenticated session. Unauthenticated users are redirected to /login by
 * NextAuth. The matcher covers all protected top-level areas; public routes
 * (/, /login, /register) and API handlers are intentionally excluded.
 * /dashboard/:path* already covers nested pages such as /dashboard/stats.
 */
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/trainer/:path*",
    "/nutrition/:path*",
    "/recommendations/:path*",
    "/exercises/:path*",
  ],
};
