import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/store/auth";
import { ApiError } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);

  const [identifier, setIdentifier] = useState(""); // username (register) or username/email (login)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) await login(identifier, password);
      else await register(identifier, email, password);
      navigate("/lobby");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>{isLogin ? "Log in" : "Create account"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted" htmlFor="identifier">
                {isLogin ? "Username or email" : "Username"}
              </label>
              <Input
                id="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isLogin ? "planeswalker_42 or you@example.com" : "planeswalker_42"}
                required
              />
            </div>
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-sm text-muted" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm text-muted" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
            </Button>
          </form>
          <p className="text-sm text-muted mt-4 text-center">
            {isLogin ? (
              <>
                No account?{" "}
                <Link to="/register" className="text-accent hover:underline">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have one?{" "}
                <Link to="/login" className="text-accent hover:underline">
                  Log in
                </Link>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
