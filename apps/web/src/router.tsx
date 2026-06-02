import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LobbyListPage } from "./pages/LobbyListPage";
import { LobbyRoomPage } from "./pages/LobbyRoomPage";
import { DecksPage } from "./pages/DecksPage";
import { GamePage } from "./pages/GamePage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/lobby", element: <LobbyListPage /> },
      { path: "/lobby/:roomId", element: <LobbyRoomPage /> },
      { path: "/decks", element: <DecksPage /> },
    ],
  },
  // Game runs full-screen without the standard chrome.
  { path: "/game/:gameId", element: <GamePage /> },
]);
