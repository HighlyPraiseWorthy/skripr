import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">SK</span>
            </div>
            <span className="text-lg font-bold text-white">Skripr</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">Sign in</Link>
            <Link href="/sign-up">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            AI-Powered YouTube Growth Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Reverse-engineer any<br />
            <span className="text-gradient">viral video</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Paste a YouTube URL. Our AI extracts the exact structural patterns that made it go viral — hook type, retention beats, pacing, CTA placement — and generates a new script using that proven formula.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg">Start Free — 3 Scripts</Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg">See How It Works</Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">No credit card required. Free tier includes 3 full scripts.</p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">How It Works</h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">Three steps from viral video to your next script</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Paste a Viral Video", desc: "Drop any YouTube URL. We extract the full transcript and analyze its viral structure — hook type, retention beat placement, pacing, and CTA strategy." },
              { step: "02", title: "Describe Your Topic", desc: "Tell us what your video is about. Our AI maps the viral structure from the source onto your topic, generating a script that follows the exact same winning formula." },
              { step: "03", title: "Get Your Script", desc: "Receive a complete, TTS-optimized script with hook options, section breakdown, metadata bundle, and a compliance check to avoid demonetization." },
            ].map(item => (
              <div key={item.step} className="bg-gray-900 border border-gray-800 rounded-xl p-8">
                <div className="text-4xl font-bold text-gradient mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Everything You Need to Grow</h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">Not just a script writer. A complete growth intelligence platform.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Viral Script Generator", desc: "Paste any YouTube URL → get a script using the exact structural patterns that made it go viral", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
              { title: "Niche Bend Engine", desc: "Find crossover opportunities between niches. Break out of your algorithmic bubble with data-driven content ideas", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
              { title: "Compliance Checker", desc: "Pre-publish audit that checks for reused content risk, AI voice detection, and metadata compliance", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
              { title: "Hook Optimizer", desc: "Generate 10 hooks ranked by predicted retention score. Pick the one that keeps viewers watching", icon: "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" },
              { title: "Metadata Bundle", desc: "Titles, descriptions, tags, thumbnail text — all optimized for YouTube search and CTR", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" },
              { title: "TTS Preview", desc: "Hear your script read aloud before committing. Optimized for AI voice with natural pacing", icon: "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" },
            ].map(f => (
              <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                <svg className="w-10 h-10 text-violet-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-gray-400 text-center mb-16">Start free. Scale when you are ready.</p>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { name: "Free", price: "$0", period: "forever", features: ["3 scripts/month", "Hook optimizer", "Basic metadata", "Community support"], cta: "Get Started", highlight: false },
              { name: "Starter", price: "$19", period: "/month", features: ["30 scripts/month", "5 Niche Bends", "Full metadata bundle", "TTS preview", "Email support"], cta: "Start Free Trial", highlight: false },
              { name: "Pro", price: "$39", period: "/month", features: ["Unlimited scripts", "Unlimited Niche Bends", "Compliance checker", "Priority support", "API access"], cta: "Start Free Trial", highlight: true },
              { name: "Agency", price: "$99", period: "/month", features: ["Everything in Pro", "5 team seats", "100 compliance checks", "White-label option", "Dedicated support"], cta: "Contact Sales", highlight: false },
            ].map(plan => (
              <div key={plan.name} className={`rounded-xl p-6 ${plan.highlight ? "bg-gray-900 border-2 border-violet-500 shadow-lg shadow-violet-500/10" : "bg-gray-900 border border-gray-800"}`}>
                {plan.highlight && <div className="text-xs font-medium text-violet-400 mb-2">MOST POPULAR</div>}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-2 mb-6">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block">
                  <Button variant={plan.highlight ? "primary" : "secondary"} className="w-full">{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Create Viral Content?</h2>
          <p className="text-gray-400 mb-8">Join creators using Skripr to reverse-engineer what works and build channels that grow.</p>
          <Link href="/sign-up">
            <Button size="lg">Start Free Today</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">SK</span>
            </div>
            <span className="text-sm text-gray-400">Skripr</span>
          </div>
          <p className="text-sm text-gray-500">Built for faceless YouTube creators.</p>
        </div>
      </footer>
    </div>
  );
}
