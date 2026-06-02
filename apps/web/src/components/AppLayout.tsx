import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useTheme } from "@/store/theme";
import { Button } from "@/components/ui/Button";

const navItems = [
  { to: "/lobby", label: "Lobby" },
  { to: "/decks", label: "Decks" },
];

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading, fetchMe, logout } = useAuth();
  const { theme, toggle } = useTheme();

  // Bootstrap the session once on mount.
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  async function onLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="font-bold text-accent text-lg tracking-tight">
            MTG Commander
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  pathname.startsWith(item.to)
                    ? "bg-surface-2 text-white"
                    : "text-muted hover:text-white hover:bg-surface-2"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </Button>
            {loading ? null : user ? (
              <>
                <span className="hidden sm:inline text-sm text-muted">
                  Signed in as <span className="text-white">{user.username}</span>
                </span>
                <Button size="sm" variant="outline" onClick={onLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button size="sm" variant="ghost">
                    Log in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
