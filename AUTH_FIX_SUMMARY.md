# Skripr SaaS — Auth & Proxy Fix Summary

## What was fixed

### 1. Runtime TypeError "immutable" on /dashboard/scripts
**Root cause:** Clerk v7.3.3 + Next.js 16 proxy bug — `auth()` + `Response.redirect()` in proxy.ts causes header mutability conflict.

**Fix:**
- `src/middleware.ts` → renamed to `src/proxy.ts` (Next.js 16 convention)
- `proxy.ts` uses `auth.protect()` (no manual redirect) instead of `auth()` + `Response.redirect()`
- `dashboard/layout.tsx` simplified — proxy handles auth, no duplicate `auth()` call
- `ScriptsPage` converted to Server Component using `auth()` directly
- `middleware.ts` re-export added:
  ```ts
  export { default } from "./proxy";
  ```

### 2. Vercel production 404 for /dashboard/*
**Issue:** Vercel CDN serves stale 404 cache + all dashboard routes missing
- Locally: ✅ 200 on all `/dashboard/*` routes  
- Vercel: ❌ 404 on all `/dashboard/*` routes (except `/sign-in` works)

**Possible causes (not yet confirmed):**
1. Vercel CDN stale cache (Etag: W/..., consistent 404s)
2. The `auth()` call in `settings/page.tsx` might fail static gen on Vercel build
3. Environment-specific build issue on Vercel

**Fix attempted:**
- `settings/page.tsx` — added `export const dynamic = "force-dynamic";` to ensure `auth()` runs at request time, not build time
- `middleware.ts` re-export added for Vercel compatibility

### 3. Google sign-in redirect to landing page
**Fix applied:**
- `SignIn` page now sits at root catch-all (`[[...sign-in]]`)
- `proxy.ts` passes `redirectUrl` via query param for unauthenticated accesses
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard/scripts` ✅ in Vercel
- `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ✅ updated in Vercel

---

## Still needs manual verification

1. **Production 404 /dashboard/*** — may require Vercel build cache purge
2. **Google redirect** — test in incognito: does it land on `/dashboard/scripts`?
3. **Cookie persistence** — sign in, close tab, reopen — still logged in?

### To verify on Vercel:
- [ ] Vercel Dashboard → Deployments → latest → Deployments & Functions → check build logs
- [ ] If build shows errors for `scripts/page.tsx` or `settings/page.tsx`, add `export const revalidate = 0;` or `dynamic = 'force-dynamic'`
- [ ] Purge CDN cache from Vercel DevTools → Purge (all routes)
