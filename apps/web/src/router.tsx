import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
// Small, always-needed pages stay eager.
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

// Heavier pages are code-split so the initial bundle stays small.
const LobbyListPage = lazy(() => import("./pages/LobbyListPage").then((m) => ({ default: m.LobbyListPage })));
const LobbyRoomPage = lazy(() => import("./pages/LobbyRoomPage").then((m) => ({ default: m.LobbyRoomPage })));
const DecksPage = lazy(() => import("./pages/DecksPage").then((m) => ({ default: m.DecksPage })));
const DeckEditorPage = lazy(() => import("./pages/DeckEditorPage").then((m) => ({ default: m.DeckEditorPage })));
const PreconsPage = lazy(() => import("./pages/PreconsPage").then((m) => ({ default: m.PreconsPage })));
const MatchesPage = lazy(() => import("./pages/MatchesPage").then((m) => ({ default: m.MatchesPage })));
const GamePage = lazy(() => import("./pages/GamePage").then((m) => ({ default: m.GamePage })));

const Fallback = () => <div className="py-20 text-center text-muted">Loading…</div>;

function guard(node: ReactNode) {
  return (
    <RequireAuth>
      <Suspense fallback={<Fallback />}>{node}</Suspense>
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/lobby", element: guard(<LobbyListPage />) },
      { path: "/lobby/:roomId", element: guard(<LobbyRoomPage />) },
      { path: "/decks", element: guard(<DecksPage />) },
      { path: "/decks/:id/edit", element: guard(<DeckEditorPage />) },
      { path: "/precons", element: guard(<PreconsPage />) },
      { path: "/matches", element: guard(<MatchesPage />) },
    ],
  },
  // Game runs full-screen without the standard chrome.
  {
    path: "/game/:gameId",
    element: (
      <Suspense fallback={<Fallback />}>
        <GamePage />
      </Suspense>
    ),
  },
]);
