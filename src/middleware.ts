import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookies and redirects signed-out visitors to /signin.
 * This is a convenience gate; real authorization happens in server code (auth() + requirePermission()).
 * API routes are excluded and enforce their own checks.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const devOk = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "true" && !!req.cookies.get("ci_dev_user");
  let signedIn = devOk;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!signedIn && url && key) {
    const sb = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    signedIn = !!(await sb.auth.getUser()).data.user;
  }

  if (!signedIn) {
    const to = new URL("/signin", req.url);
    to.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = { matcher: ["/((?!api|signin|signup|forgot-password|set-password|auth|_next|favicon.ico).*)"] };
