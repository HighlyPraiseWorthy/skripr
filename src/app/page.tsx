import Link from "next/link";
import { Button } from "@/components/ui/Button";
export default function LandingPage() {
return (
<div className="min-h-screen bg-gray-950">
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
<section className="max-w-7xl mx-auto px-6 pt-20 pb-32">
<div className="text-center max-w-4xl mx-auto">
<h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
Reverse-engineer any<br />
<span className="text-gradient">viral video</span>
</h1>
<p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
Paste a YouTube URL. Our AI extracts the exact structural patterns that made it go viral and generates a new script using that proven formula.
</p>
<div className="flex items-center justify-center gap-4">
<Link href="/sign-up">
<Button size="lg">Start Free — 3 Scripts</Button>
</Link>
</div>
</div>
</section>
<footer className="border-t border-gray-800 py-8">
<div className="max-w-7xl mx-auto px-6 text-center">
<p className="text-sm text-gray-500">Skripr — Built for faceless YouTube creators.</p>
</div>
</footer>
</div>
);
}
