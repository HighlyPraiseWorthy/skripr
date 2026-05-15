"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { NICHES } from "@/lib/data/niches";

export default function HooksPage() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("educational");
  const [isLoading, setIsLoading] = useState(false);
  const [hooks, setHooks] = useState<any[]>([]);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/hooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, niche, tone, count: 10 }),
      });
      const data = await res.json();
      setHooks(data.hooks || []);
    } catch {
      setHooks([]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Hook Optimizer</h1>
        <p className="text-gray-400 mt-1">Generate and rank hooks by predicted retention</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Generate Hooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Video Topic"
            placeholder="e.g., 5 money habits that will make you rich"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Niche"
              options={[{ value: "", label: "Select niche..." }, ...nicheOptions]}
              value={niche}
              onChange={e => setNiche(e.target.value)}
            />
            <Select
              label="Tone"
              options={[
                { value: "educational", label: "Educational" },
                { value: "entertaining", label: "Entertaining" },
                { value: "storytelling", label: "Storytelling" },
                { value: "hype", label: "Hype / Energetic" },
              ]}
              value={tone}
              onChange={e => setTone(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} isLoading={isLoading} disabled={!topic || !niche}>
            {isLoading ? "Generating..." : "Generate 10 Hooks"}
          </Button>
        </CardContent>
      </Card>

      {hooks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Ranked Hooks</h2>
          {hooks.map((hook: any, i: number) => (
            <Card key={i} variant="interactive">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                  i === 1 ? "bg-gray-400/20 text-gray-300" :
                  i === 2 ? "bg-orange-500/20 text-orange-400" :
                  "bg-gray-800 text-gray-400"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium mb-1">{hook.text}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="info">{hook.type}</Badge>
                    <span className="text-xs text-gray-400">Predicted retention: {hook.predictedRetention}%</span>
                  </div>
                  <p className="text-xs text-gray-500">{hook.reasoning}</p>
                </div>
                <div className={`text-lg font-bold ${
                  hook.predictedRetention >= 70 ? "text-green-400" :
                  hook.predictedRetention >= 50 ? "text-yellow-400" : "text-red-400"
                }`}>
                  {hook.predictedRetention}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}