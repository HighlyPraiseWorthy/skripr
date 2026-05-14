interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ScoreRing({ score, size = 80, strokeWidth = 6, label }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : score >= 25 ? "#f97316" : "#ef4444";

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1f2937" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className="absolute flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold text-white">{score}</span>
      </span>
      {label && <span className="text-xs text-gray-400">{label}</span>}
    </div>
  );
}