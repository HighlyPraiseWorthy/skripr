import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
const isProtectedRoute = createRouteMatcher([
"/dashboard(.)",
"/scripts(.)",
"/settings(.)",
"/compliance(.)",
"/hooks(.)",
"/metadata(.)",
"/niche-bend(.)",
"/remixer(.)",
"/outlier-ideas(.)",
"/viral-score(.)",
"/trending(.)",
"/calendar(.)",
"/titles(.)",
"/chapters(.)",
"/api/scripts(.)",
"/api/compliance(.)",
"/api/hooks(.)",
"/api/metadata(.)",
"/api/niche-bend(.)",
"/api/transcript(.)",
"/api/structural-analysis(.)",
"/api/outliers(.)",
"/api/remixer(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
if (isProtectedRoute(req)) {
await auth.protect();
}
});

export const config = {
matcher: [
"/((?!_next|[^?]\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).)",
"/(api|trpc)(.*)",
],
};
