import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = await updateSession(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured =
    !!url &&
    !!anonKey &&
    !url.includes("your-project") &&
    !anonKey.includes("your-anon-key");

  if (!configured) {
    return response;
  }

  const { createServerClient } = await import("@supabase/ssr");
  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isWaiting = pathname === "/waiting";

  if (!user && !isPublic && pathname !== "/") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublic) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    return NextResponse.redirect(dash);
  }

  // Unauthenticated users cannot open waiting
  if (!user && isWaiting) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
