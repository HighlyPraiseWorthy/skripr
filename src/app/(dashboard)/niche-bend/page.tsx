"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { NICHES, getAdjacentNiches, calculateBendPotential, type Niche } from "@/lib/data/niches";

interface CrossoverIdea {
  title: string;
  description: string;
  viralPotential: number;
  competitionLevel: string;
  format: string;
}

export default function NicheBendPage() {
  const [selectedNiche, setSelectedNiche] = useState("");
  const [adjacentNiches, setAdjacentNiches] = useState<Niche[]>([]);
  const [selectedAdjacent, setSelectedAdjacent] = useState("");
  const [ideas, setIdeas] = useState<CrossoverIdea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const nicheOptions = NICHES.map(n => ({ value: n.id, label: n.name }));

  function handleNicheSelect(nicheId: string) {
    setSelectedNiche(nicheId);
    setSelectedAdjacent("");
    setIdeas([]);
    setAdjacentNiches(getAdjacentNiches(nicheId));
  }

  async function generateIdeas() {
    if (!selectedNiche || !selectedAdjacent) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/niche-bend/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicheA: selectedNiche, nicheB: selectedAdjacent }),
      });
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch {
      setIdeas([]);
    } finally {
      setIsLoading(false);
    }
  }

  const bendPotential = selectedNiche && selectedAdjacent
    ? calculateBendPotential(selectedNiche, selectedAdjacent)
    : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Niche Bend Engine</h1>
        <p className="text-gray-400 mt-1">Find crossover opportunities between niches to break out of your algorithmic bubble</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Niche</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              options={[{ value: "", label: "Select your niche..." }, ...nicheOptions]}
              value={selectedNiche}
              onChange={e => handleNicheSelect(e.target.value)}
            />
            {selectedNiche && (
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-300">{NICHES.find(n => n.id === selectedNiche)?.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>Avg RPM: ${NICHES.find(n => n.id === selectedNiche)?.avgRPM}</span>
                  <span>Competition: {NICHES.find(n => n.id === selectedNiche)?.competitionLevel}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bridge To</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              options={[
                { value: "", label: "Select adjacent niche..." },
                ...adjacentNiches.map(n => ({ value: n.id, label: n.name })),
              ]}
              value={selectedAdjacent}
              onChange={e => setSelectedAdjacent(e.target.value)}
              disabled={!selectedNiche}
            />
            {selectedAdjacent && (
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-300">{NICHES.find(n => n.id === selectedAdjacent)?.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>Avg RPM: ${NICHES.find(n => n.id === selectedAdjacent)?.avgRPM}</span>
                  <span>Competition: {NICHES.find(n => n.id === selectedAdjacent)?.competitionLevel}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedNiche && selectedAdjacent && (
        <Card className="mb-8">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Bend Potential Score</h3>
                <p className="text-sm text-gray-400">How strong is this crossover opportunity?</p>
              </div>
              <div className={`text-3xl font-bold ${bendPotential >= 70 ? "text-green-400" : bendPotential >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                {bendPotential}/100
              </div>
            </div>
            <Button onClick={generateIdeas} isLoading={isLoading} className="mt-4">
              {isLoading ? "Generating..." : "Generate Crossover Ideas"}
            </Button>
          </CardContent>
        </Card>
      )}

      {ideas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Crossover Ideas</h2>
          {ideas.map((idea, i) => (
            <Card key={i} variant="interactive">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-white mb-1">{idea.title}</h3>
                  <p className="text-sm text-gray-400 mb-3">{idea.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={idea.viralPotential >= 70 ? "success" : idea.viralPotential >= 40 ? "warning" : "danger"}>
                      Viral Potential: {idea.viralPotential}%
                    </Badge>
                    <Badge>{idea.format}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="secondary">Generate Script</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}