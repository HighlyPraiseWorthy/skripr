# ScriptFactory — Vercel Deployment Checklist

## Environment Variables to Set in Vercel

### Required
```
NEXT_PUBLIC_SUPABASE_URL=https://yinkfjmmcpzphlqmvoge.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from .env.local>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard > Settings > API>
ANTHROPIC_API_KEY=<from .env.local>
CLERK_SECRET_KEY=<from Clerk dashboard>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<from .env.local>
CLERK_WEBHOOK_SECRET=<from Clerk dashboard > Webhooks>
STRIPE_SECRET_KEY=<from Stripe dashboard>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<from Stripe dashboard>
STRIPE_WEBHOOK_SECRET=<from Stripe dashboard > Webhooks>
```

### Required — Stripe Price IDs
```
STRIPE_STARTER_PRICE_ID=<create product in Stripe, copy price ID>
STRIPE_PRO_PRICE_ID=<create product in Stripe, copy price ID>
STRIPE_AGENCY_PRICE_ID=<create product in Stripe, copy price ID>
```

## Pre-deploy Steps

1. Run `npx vercel` and link project
2. Set all environment variables above in Vercel dashboard
3. Run `npx vercel --prod`

## Post-deploy Steps

4. Create Stripe webhook endpoint: `https://<domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Create Clerk webhook endpoint: `https://<domain>/api/clerk/webhook` (if using webhooks for user sync)
6. Update Clerk allowed redirect URLs to include production domain
7. Test full flow: sign up > generate script > save script > upgrade to Pro

## Gotchas

- `src/middleware.ts` shows a deprecation warning about file convention — this is Clerk's setup and should NOT be renamed
- All `@/lib/` imports use the `@/*` path alias defined in tsconfig.json
- Supabase admin client (supabaseAdmin) uses lazy Proxy initialization to avoid build-time errors
- The `usage_tracking` table's RLS uses `auth.uid()` which matches the `profiles.id` UUID, not the Clerk user ID
