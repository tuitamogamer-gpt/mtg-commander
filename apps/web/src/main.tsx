import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { CardHoverPreview } from "./components/CardHoverPreview";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <CardHoverPreview />
      <Toaster theme="dark" position="top-right" richColors closeButton />
    </ErrorBoundary>
  </React.StrictMode>
);
