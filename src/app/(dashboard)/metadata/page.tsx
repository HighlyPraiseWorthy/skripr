"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { NICHES } from "@/lib/data/niches";

export default function MetadataPage() {
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/metadata/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, title, niche }),
      });
      const data = await res.json();
      setMetadata(data);
    } catch {
      setMetadata(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Metadata Generator</h1>
        <p className="text-gray-400 mt-1">Generate titles, descriptions, tags, and thumbnail text</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Video Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input label="Working Title" placeholder="Your video title" value={title} onChange={e => setTitle(e.target.value)} />
          <Select label="Niche" options={[{ value: "", label: "Select niche..." }, ...nicheOptions]} value={niche} onChange={e => setNiche(e.target.value)} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Script / Content</label>
            <textarea className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-[150px]" placeholder="Paste your script or content outline..." value={script} onChange={e => setScript(e.target.value)} />
          </div>
          <Button onClick={handleGenerate} isLoading={isLoading} disabled={!script || !title}>
            {isLoading ? "Generating..." : "Generate Metadata"}
          </Button>
        </CardContent>
      </Card>

      {metadata && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Title Options</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metadata.titles?.map((t: string, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                    <span className="text-xs text-gray-500 w-6">{i + 1}.</span>
                    <p className="text-sm text-gray-200 flex-1">{t}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-gray-800 rounded-lg p-4">
                <pre className="text-sm text-gray-200 whitespace-pre-wrap">{metadata.description}</pre>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {metadata.tags?.map((tag: string, i: number) => (
                    <Badge key={i}>{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Thumbnail Text</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metadata.thumbnailText?.map((text: string, i: number) => (
                    <div key={i} className="p-2 bg-gray-800 rounded text-sm text-gray-200">{text}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}