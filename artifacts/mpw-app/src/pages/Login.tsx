import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Building2, Mail } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await loginMutation.mutateAsync({ data: { email, password } });
      login(result.token);
      if (result.user.role === "admin") {
        navigate("/dashboard");
      } else {
        navigate("/bills");
      }
    } catch {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-secondary-foreground" />
          </div>
          <div>
            <div className="font-bold text-lg">M.P. Warehousing</div>
            <div className="text-xs opacity-60">&amp; Logistics Corporation</div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Warehouse Management<br />
            <span className="text-secondary">Made Simple.</span>
          </h1>
          <p className="text-primary-foreground opacity-60 text-base leading-relaxed max-w-md">
            Manage commodities, track bills, and streamline approval workflows across all branches from a single platform.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { label: "Active Branches", value: "12+" },
              { label: "Bills Processed", value: "5,000+" },
              { label: "Commodities", value: "20+" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-secondary">{stat.value}</div>
                <div className="text-xs text-primary-foreground opacity-50 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-primary-foreground opacity-30">
          © 2025 M.P. Warehousing &amp; Logistics Corporation. All rights reserved.
        </div>
      </div>

      {/* Right login panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold text-foreground">M.P. Warehousing</div>
              <div className="text-xs text-muted-foreground">&amp; Logistics Corporation</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Sign in</h2>
          <p className="text-muted-foreground text-sm mb-8">Enter your credentials to access the portal.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mpw.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 p-4 bg-muted rounded-lg text-xs text-muted-foreground">
            <div className="font-medium mb-2">Demo Credentials</div>
            <div className="space-y-1">
              <div><span className="font-medium">Admin:</span> admin@mpw.com / admin123</div>
              <div><span className="font-medium">Operator 1:</span> operator1@mpw.com / admin123</div>
              <div><span className="font-medium">Operator 2:</span> operator2@mpw.com / admin123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
