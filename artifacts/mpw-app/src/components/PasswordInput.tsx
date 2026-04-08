import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  inputClassName?: string;
}

export function PasswordInput({ leftIcon, inputClassName = "", className = "", ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  const base =
    "w-full py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm " +
    inputClassName;

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {leftIcon}
        </span>
      )}
      <input
        {...props}
        type={show ? "text" : "password"}
        className={base + (leftIcon ? " pl-10" : " pl-3") + " pr-10"}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
