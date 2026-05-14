import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, options, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors ${
            error ? "border-red-500" : "border-gray-700"
          } ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";