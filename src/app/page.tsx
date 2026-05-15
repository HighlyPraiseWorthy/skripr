import Link from "next/link";

export default function LandingPage() {
return (
<div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
<div className="fixed inset-0 pointer-events-none">
<div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px]" />
<div className="absolute top-1/3 right-1/4 w-96 h-96 bg-fuchsia-600/15 rounded-full blur-[128px]" />
<div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
</div>
<nav className="relative z-10 border-b border-white/5">
<div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
<span className="text-white font-bold text-sm">SK</span>
</div>
<span className="text-xl font-bold tracking-tight">Skripr</span>
</div>
<div className="flex items-center gap-3">
<Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">Sign in</Link>
<Link href="/sign-up" className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-500/25">Get Started Free</Link>
</div>
</div>
</nav>
<section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 md:pt-32 md:pb-40">
<div className="text-center max-w-4xl mx-auto">
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-8">
<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
Now in public beta — Free tier available
</div>
<h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
<span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">Reverse-engineer</span>
<br />
<span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">any viral video</span>
</h1>
<p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
Paste any YouTube URL. Our AI extracts the exact structural patterns that made it go viral and generates a new optimized script using that proven formula.
</p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
<Link href="/sign-up" className="w-full sm:w-auto px-8 py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-xl shadow-violet-500/25 text-center">
Start Free — 3 Scripts Included
</Link>
</div>
<p className="text-sm text-gray-500">No credit card required • Cancel anytime</p>
<div className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-20 pt-10 border-t border-white/5">
<div>
<div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">10K+</div>
<div className="text-sm text-gray-500 mt-1">Scripts Generated</div>
</div>
<div>
<div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">500+</div>
<div className="text-sm text-gray-500 mt-1">Active Creators</div>
</div>
<div>
<div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">98%</div>
<div className="text-sm text-gray-500 mt-1">Satisfaction</div>
</div>
</div>
</div>
</section>
<section id="features" className="relative z-10 border-t border-white/5 py-24 md:py-32">
<div className="max-w-7xl mx-auto px-6">
<div className="text-center mb-16">
<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Everything You Need to <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Grow</span></h2>
<p className="text-gray-400 text-lg max-w-2xl mx-auto">Not just a script writer. A complete growth intelligence platform.</p>
</div>
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all">
<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-5"><span className="text-white text-lg">✦</span></div>
<h3 className="text-lg font-semibold text-white mb-2">Viral Script Generator</h3>
<p className="text-gray-400 text-sm leading-relaxed">Paste any YouTube URL and get a complete script using the exact structural patterns that made it go viral</p>
</div>
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all">
<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center mb-5"><span className="text-white text-lg">✦</span></div>
<h3 className="text-lg font-semibold text-white mb-2">Niche Bend Engine</h3>
<p className="text-gray-400 text-sm leading-relaxed">Find crossover opportunities between niches with data-driven content ideas</p>
</div>
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all">
<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-5"><span className="text-white text-lg">✦</span></div>
<h3 className="text-lg font-semibold text-white mb-2">Compliance Checker</h3>
<p className="text-gray-400 text-sm leading-relaxed">Pre-publish audit for reused content risk and metadata compliance</p>
</div>
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all">
<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-5"><span className="text-white text-lg">✦</span></div>
<h3 className="text-lg font-semibold text-white mb-2">A/B Title Generator</h3>
<p className="text-gray-400 text-sm leading-relaxed">Generate 10 title variations ranked by predicted CTR</p>
</div>
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all">
<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-5"><span className="text-white text-lg">✦</span></div>
<h3 className="text-lg font-semibold text-white mb-2">Metadata Bundle</h3>
<p className="text-gray-400 text-sm leading-relaxed">Titles, descriptions, tags, thumbnail text — all optimized for YouTube</p>
</div>
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.04] transition-all">
<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center mb-5"><span className="text-white text-lg">✦</span></div>
<h3 className="text-lg font-semibold text-white mb-2">Content Remixer</h3>
<p className="text-gray-400 text-sm leading-relaxed">Paste any viral video URL and we break down the hook, structure, and retention triggers</p>
</div>
</div>
</div>
</section>
<section className="relative z-10 border-t border-white/5 py-24 md:py-32">
<div className="max-w-4xl mx-auto px-6">
<div className="text-center mb-16">
<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Three Steps to Your <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Next Viral Script</span></h2>
</div>
<div className="space-y-8">
<div className="flex gap-6 items-start">
<div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center"><span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">01</span></div>
<div><h3 className="text-xl font-semibold text-white mb-2">Paste a Viral Video</h3><p className="text-gray-400 leading-relaxed">Drop any YouTube URL. We extract the full transcript and analyze its viral structure.</p></div>
</div>
<div className="flex gap-6 items-start">
<div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center"><span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">02</span></div>
<div><h3 className="text-xl font-semibold text-white mb-2">Describe Your Topic</h3><p className="text-gray-400 leading-relaxed">Tell us what your video is about. Our AI maps the viral structure onto your topic.</p></div>
</div>
<div className="flex gap-6 items-start">
<div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center"><span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">03</span></div>
<div><h3 className="text-xl font-semibold text-white mb-2">Get Your Script</h3><p className="text-gray-400 leading-relaxed">Receive a complete script with hook options, section breakdown, and metadata bundle.</p></div>
</div>
</div>
</div>
</section>
<section className="relative z-10 border-t border-white/5 py-24 md:py-32">
<div className="max-w-4xl mx-auto px-6 text-center">
<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Ready to Create <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Viral Content?</span></h2>
<p className="text-gray-400 text-lg mb-10">Join creators using Skripr to reverse-engineer what works.</p>
<Link href="/sign-up" className="inline-block px-10 py-5 text-lg font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-xl shadow-violet-500/25">Start Free Today</Link>
</div>
</section>
<footer className="relative z-10 border-t border-white/5 py-12">
<div className="max-w-7xl mx-auto px-6 text-center">
<p className="text-sm text-gray-500">Skripr — Built for YouTube creators.</p>
</div>
</footer>
</div>
);
}
