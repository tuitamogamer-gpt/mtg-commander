import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { CardHoverPreview } from "./components/CardHoverPreview";
import { useTheme } from "./store/theme";
import "./index.css";

function ThemedToaster() {
  const theme = useTheme((s) => s.theme);
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <CardHoverPreview />
    <ThemedToaster />
  </React.StrictMode>
);
