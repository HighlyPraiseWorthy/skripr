import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const lessons = [
  { title: "The 8 Hook Types That Keep Viewers Watching", category: "Hooks", level: "Beginner", duration: "5 min" },
  { title: "How to Structure a Viral Script", category: "Script Writing", level: "Beginner", duration: "8 min" },
  { title: "Niche Bending: Breaking Out of Your Algorithm Bubble", category: "Growth", level: "Intermediate", duration: "6 min" },
  { title: "Avoiding Demonetization: What YouTube's AI Actually Flags", category: "Compliance", level: "Intermediate", duration: "10 min" },
  { title: "TTS Optimization: Making AI Voice Sound Human", category: "Production", level: "Beginner", duration: "7 min" },
  { title: "Thumbnail Psychology: What Makes People Click", category: "Thumbnails", level: "Intermediate", duration: "6 min" },
  { title: "Retention Beats: The Secret to 70%+ Audience Retention", category: "Script Writing", level: "Advanced", duration: "12 min" },
  { title: "Metadata Mastery: Titles, Tags, and Descriptions That Rank", category: "SEO", level: "Beginner", duration: "8 min" },
];

export default function EducatePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Learn</h1>
        <p className="text-gray-400 mt-1">Master the skills that grow faceless YouTube channels</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {lessons.map((lesson, i) => (
          <Card key={i} variant="interactive">
            <div className="flex items-start justify-between mb-3">
              <Badge variant={
                lesson.level === "Beginner" ? "success" :
                lesson.level === "Intermediate" ? "warning" : "danger"
              }>{lesson.level}</Badge>
              <span className="text-xs text-gray-500">{lesson.duration}</span>
            </div>
            <h3 className="font-medium text-white mb-1">{lesson.title}</h3>
            <p className="text-sm text-gray-400">{lesson.category}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}