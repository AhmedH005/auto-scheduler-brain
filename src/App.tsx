import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Landing from "./pages/Landing";
import Features from "./pages/Features";
import FAQ from "./pages/FAQ";
import Roadmap from "./pages/Roadmap";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            {/* DEV: send root straight to the calendar so the test loop is
                instant. To restore the marketing landing page, swap back
                to `<Route path="/" element={<Landing />} />`. */}
            <Route
              path="/"
              element={
                import.meta.env.DEV
                  ? <Navigate to="/app/calendar" replace />
                  : <Landing />
              }
            />
            <Route path="/features" element={<Features />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected app routes */}
            <Route
              path="/app"
              element={<Navigate to="/app/calendar" replace />}
            />
            <Route
              path="/app/calendar"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
  </ErrorBoundary>
);

export default App;
