import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Leaves Draft Mode (see `../route.ts`) and goes back to the page the banner
 * was pressed on, now as everyone sees it. A POST, from the banner's form:
 * it changes what later requests get. Open to anyone, which `proxy.ts` lets
 * through without a session — turning the mode off only ever takes something
 * away, and an expired session should not trap the editor in it.
 *
 * "Back" is the Referer, and only when it is this site: the banner is a
 * server-rendered form in the layout, which knows no path, and a client
 * component there to supply one would ship with every page.
 */
export async function POST(request: Request) {
  (await draftMode()).disable();
  const here = new URL(request.url);
  const referer = request.headers.get("referer");
  let back = new URL("/", here);
  try {
    const from = referer ? new URL(referer) : null;
    if (from && from.origin === here.origin) back = from;
  } catch {
    // A malformed Referer goes home.
  }
  return NextResponse.redirect(back, 303);
}
