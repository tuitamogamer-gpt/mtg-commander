import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LobbyListPage } from "./pages/LobbyListPage";
import { LobbyRoomPage } from "./pages/LobbyRoomPage";
import { DecksPage } from "./pages/DecksPage";
import { DeckEditorPage } from "./pages/DeckEditorPage";
import { PreconsPage } from "./pages/PreconsPage";
import { GamePage } from "./pages/GamePage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      {
        path: "/lobby",
        element: (
          <RequireAuth>
            <LobbyListPage />
          </RequireAuth>
        ),
      },
      {
        path: "/lobby/:roomId",
        element: (
          <RequireAuth>
            <LobbyRoomPage />
          </RequireAuth>
        ),
      },
      {
        path: "/decks",
        element: (
          <RequireAuth>
            <DecksPage />
          </RequireAuth>
        ),
      },
      {
        path: "/decks/:id/edit",
        element: (
          <RequireAuth>
            <DeckEditorPage />
          </RequireAuth>
        ),
      },
      {
        path: "/precons",
        element: (
          <RequireAuth>
            <PreconsPage />
          </RequireAuth>
        ),
      },
    ],
  },
  // Game runs full-screen without the standard chrome.
  { path: "/game/:gameId", element: <GamePage /> },
]);
