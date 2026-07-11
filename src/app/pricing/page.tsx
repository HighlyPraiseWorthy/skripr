import { permanentRedirect } from "next/navigation";

export default function PricingPage() {
  // Permanent (308) so Google stops re-crawling this and attributes it to the
  // homepage. Kept out of the sitemap; exists only for humans typing /pricing.
  permanentRedirect("/#pricing");
}
