export interface Niche {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  avgRPM: number;
  competitionLevel: "low" | "medium" | "high";
  adjacentNicheIds: string[];
}

export const NICHES: Niche[] = [
  { id: "personal-finance", name: "Personal Finance", description: "Money management, investing, saving", parentId: null, avgRPM: 15, competitionLevel: "high", adjacentNicheIds: ["self-improvement", "real-estate", "tech", "productivity"] },
  { id: "self-improvement", name: "Self Improvement", description: "Productivity, habits, mindset", parentId: null, avgRPM: 12, competitionLevel: "high", adjacentNicheIds: ["personal-finance", "fitness", "mental-health", "productivity"] },
  { id: "fitness", name: "Fitness & Health", description: "Workouts, nutrition, wellness", parentId: null, avgRPM: 10, competitionLevel: "high", adjacentNicheIds: ["self-improvement", "cooking", "mental-health", "sports"] },
  { id: "tech", name: "Technology", description: "Gadgets, software, AI", parentId: null, avgRPM: 18, competitionLevel: "high", adjacentNicheIds: ["personal-finance", "gaming", "science", "business"] },
  { id: "gaming", name: "Gaming", description: "Video games, esports, reviews", parentId: null, avgRPM: 6, competitionLevel: "high", adjacentNicheIds: ["tech", "entertainment", "anime", "science"] },
  { id: "true-crime", name: "True Crime", description: "Crime stories, mysteries, investigations", parentId: null, avgRPM: 8, competitionLevel: "medium", adjacentNicheIds: ["history", "psychology", "storytelling", "news"] },
  { id: "history", name: "History", description: "Historical events, documentaries", parentId: null, avgRPM: 9, competitionLevel: "medium", adjacentNicheIds: ["true-crime", "science", "geography", "education"] },
  { id: "science", name: "Science", description: "Scientific discoveries, explanations", parentId: null, avgRPM: 11, competitionLevel: "medium", adjacentNicheIds: ["tech", "history", "education", "space"] },
  { id: "cooking", name: "Cooking & Food", description: "Recipes, food reviews, challenges", parentId: null, avgRPM: 8, competitionLevel: "high", adjacentNicheIds: ["fitness", "travel", "entertainment", "culture"] },
  { id: "travel", name: "Travel", description: "Destinations, tips, vlogs", parentId: null, avgRPM: 10, competitionLevel: "medium", adjacentNicheIds: ["cooking", "geography", "culture", "photography"] },
  { id: "real-estate", name: "Real Estate", description: "Property, investing, market analysis", parentId: null, avgRPM: 20, competitionLevel: "medium", adjacentNicheIds: ["personal-finance", "business", "architecture", "travel"] },
  { id: "business", name: "Business & Entrepreneurship", description: "Startups, strategy, case studies", parentId: null, avgRPM: 16, competitionLevel: "high", adjacentNicheIds: ["personal-finance", "tech", "self-improvement", "real-estate"] },
  { id: "mental-health", name: "Mental Health", description: "Psychology, therapy, wellness", parentId: null, avgRPM: 10, competitionLevel: "medium", adjacentNicheIds: ["self-improvement", "fitness", "psychology", "education"] },
  { id: "psychology", name: "Psychology", description: "Human behavior, cognitive science", parentId: null, avgRPM: 12, competitionLevel: "medium", adjacentNicheIds: ["mental-health", "true-crime", "self-improvement", "science"] },
  { id: "education", name: "Education", description: "Learning, tutorials, explainers", parentId: null, avgRPM: 9, competitionLevel: "medium", adjacentNicheIds: ["science", "history", "tech", "productivity"] },
  { id: "productivity", name: "Productivity", description: "Tools, systems, efficiency", parentId: null, avgRPM: 14, competitionLevel: "medium", adjacentNicheIds: ["self-improvement", "tech", "business", "education"] },
  { id: "entertainment", name: "Entertainment", description: "Pop culture, reactions, commentary", parentId: null, avgRPM: 5, competitionLevel: "high", adjacentNicheIds: ["gaming", "cooking", "storytelling", "news"] },
  { id: "storytelling", name: "Storytelling", description: "Narrated stories, Reddit stories", parentId: null, avgRPM: 7, competitionLevel: "medium", adjacentNicheIds: ["true-crime", "entertainment", "history", "psychology"] },
  { id: "automotive", name: "Automotive", description: "Cars, reviews, industry news", parentId: null, avgRPM: 14, competitionLevel: "medium", adjacentNicheIds: ["tech", "business", "travel", "science"] },
  { id: "space", name: "Space & Astronomy", description: "Space exploration, astronomy", parentId: null, avgRPM: 12, competitionLevel: "low", adjacentNicheIds: ["science", "tech", "history", "education"] },
  { id: "geography", name: "Geography", description: "Countries, maps, cultures", parentId: null, avgRPM: 10, competitionLevel: "low", adjacentNicheIds: ["travel", "history", "culture", "science"] },
  { id: "culture", name: "Culture & Society", description: "Social trends, cultural analysis", parentId: null, avgRPM: 8, competitionLevel: "medium", adjacentNicheIds: ["geography", "travel", "history", "psychology"] },
  { id: "sports", name: "Sports", description: "Sports analysis, highlights", parentId: null, avgRPM: 7, competitionLevel: "high", adjacentNicheIds: ["fitness", "entertainment", "business", "gaming"] },
  { id: "anime", name: "Anime & Manga", description: "Anime reviews, analysis, news", parentId: null, avgRPM: 6, competitionLevel: "medium", adjacentNicheIds: ["gaming", "entertainment", "culture", "storytelling"] },
  { id: "news", name: "News & Current Events", description: "News analysis, commentary", parentId: null, avgRPM: 6, competitionLevel: "high", adjacentNicheIds: ["true-crime", "business", "culture", "entertainment"] },
  { id: "photography", name: "Photography", description: "Photo techniques, gear reviews", parentId: null, avgRPM: 11, competitionLevel: "low", adjacentNicheIds: ["travel", "tech", "art", "education"] },
  { id: "art", name: "Art & Design", description: "Art techniques, design, creativity", parentId: null, avgRPM: 9, competitionLevel: "low", adjacentNicheIds: ["photography", "culture", "education", "tech"] },
  { id: "music", name: "Music", description: "Music analysis, production, reviews", parentId: null, avgRPM: 7, competitionLevel: "medium", adjacentNicheIds: ["entertainment", "culture", "tech", "education"] },
  { id: "architecture", name: "Architecture", description: "Buildings, design, urban planning", parentId: null, avgRPM: 13, competitionLevel: "low", adjacentNicheIds: ["real-estate", "art", "history", "geography"] },
];

export function getNicheById(id: string): Niche | undefined {
  return NICHES.find(n => n.id === id);
}

export function getAdjacentNiches(nicheId: string): Niche[] {
  const niche = getNicheById(nicheId);
  if (!niche) return [];
  return niche.adjacentNicheIds.map(id => getNicheById(id)).filter(Boolean) as Niche[];
}

export function calculateBendPotential(nicheA: string, nicheB: string): number {
  const a = getNicheById(nicheA);
  const b = getNicheById(nicheB);
  if (!a || !b) return 0;
  
  // Higher score = better crossover potential
  let score = 50; // base
  
  // Adjacent niches get a boost
  if (a.adjacentNicheIds.includes(nicheB)) score += 20;
  
  // Low competition in either niche = more opportunity
  if (a.competitionLevel === "low") score += 10;
  if (b.competitionLevel === "low") score += 10;
  
  // RPM synergy
  score += Math.min(a.avgRPM, b.avgRPM) / 2;
  
  return Math.min(Math.round(score), 100);
}