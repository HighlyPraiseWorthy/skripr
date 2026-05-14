import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-gray-800 text-gray-300 border-gray-700",
    success: "bg-green-900/50 text-green-400 border-green-700",
    warning: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
    danger: "bg-red-900/50 text-red-400 border-red-700",
    info: "bg-violet-900/50 text-violet-400 border-violet-700",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`} {...props} />
  );
}