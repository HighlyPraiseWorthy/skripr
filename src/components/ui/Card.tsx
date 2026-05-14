import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlighted" | "interactive";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-gray-900 border border-gray-800",
      highlighted: "bg-gray-900 border border-violet-500/30 shadow-lg shadow-violet-500/5",
      interactive: "bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer",
    };

    return (
      <div ref={ref} className={`rounded-xl p-6 ${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-4 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-lg font-semibold text-white ${className}`} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm text-gray-400 mt-1 ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}