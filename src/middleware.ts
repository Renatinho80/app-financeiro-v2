import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Bloqueia paths que tentam traversal de diretório
  const pathname = request.nextUrl.pathname;
  if (pathname.includes("..") || pathname.includes("%2e%2e") || pathname.includes("%2F")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const response = await updateSession(request);

  // Garante que headers de segurança estejam presentes mesmo em redirects do middleware
  // (next.config.ts aplica em responses normais; aqui cobre redirects do middleware)
  if (response instanceof NextResponse) {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
