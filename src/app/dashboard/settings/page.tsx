import { auth } from "@clerk/nextjs/server";
import { UserProfile } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and subscription</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Free Plan</p>
                <p className="text-sm text-gray-400">3 scripts per month</p>
              </div>
              <Badge>ACTIVE</Badge>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 mb-3">Usage this month: 0 / 3 scripts</p>
              <form action="/api/stripe/create-checkout" method="POST">
                <input type="hidden" name="priceId" value={process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || ""} />
                <Button type="submit" size="sm">Upgrade to Starter — $19/mo</Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">Manage your payment method and billing history</p>
            <form action="/api/stripe/portal" method="POST">
              <Button type="submit" variant="secondary" size="sm">Open Billing Portal</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">Manage your account settings</p>
            <UserProfile appearance={{ elements: { card: "bg-transparent shadow-none p-0", navbar: "hidden", pageScrollBox: "p-0" } }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
