"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { NICHES } from "@/lib/data/niches";

export default function CompliancePage() {
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  async function handleCheck() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, title, niche }),
      });
      const data = await res.json();
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Compliance Checker</h1>
        <p className="text-gray-400 mt-1">Check your script before publishing to avoid demonetization</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Script to Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Video Title"
            placeholder="Your video title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Select
            label="Niche"
            options={[{ value: "", label: "Select niche..." }, ...nicheOptions]}
            value={niche}
            onChange={e => setNiche(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Script Content</label>
            <textarea
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-[200px]"
              placeholder="Paste your full script here..."
              value={script}
              onChange={e => setScript(e.target.value)}
            />
          </div>
          <Button onClick={handleCheck} isLoading={isLoading} disabled={!script || !title}>
            {isLoading ? "Checking..." : "Run Compliance Check"}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Compliance Score</h3>
                  <p className="text-sm text-gray-400">{report.summary}</p>
                </div>
                <div className={`text-4xl font-bold ${
                  report.overallScore >= 75 ? "text-green-400" :
                  report.overallScore >= 50 ? "text-yellow-400" :
                  report.overallScore >= 25 ? "text-orange-400" : "text-red-400"
                }`}>
                  {report.overallScore}
                </div>
              </div>
              <div className="mt-4">
                <Badge variant={
                  report.riskLevel === "low" ? "success" :
                  report.riskLevel === "medium" ? "warning" : "danger"
                }>
                  {report.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {report.checks.map((check: any) => (
              <Card key={check.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-white">{check.name}</h4>
                      <Badge variant={check.status === "pass" ? "success" : check.status === "warn" ? "warning" : "danger"}>
                        {check.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{check.details}</p>
                    {check.suggestions.length > 0 && (
                      <ul className="space-y-1">
                        {check.suggestions.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                            <span className="text-violet-400 mt-0.5">→</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className={`text-lg font-bold ${
                    check.score >= 75 ? "text-green-400" :
                    check.score >= 50 ? "text-yellow-400" : "text-red-400"
                  }`}>{check.score}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}