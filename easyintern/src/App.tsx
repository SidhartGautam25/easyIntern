import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Contact from "./pages/Contact.tsx";
import VerifyCertificate from "./pages/VerifyCertificate.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Admin from "./pages/Admin.tsx";
import { Navigate } from "react-router-dom";
import SuperAdmin from "./pages/SuperAdmin.tsx";
import StaffDashboard from "./pages/StaffDashboard.tsx";
import Benefits from "./pages/Benefits.tsx";
import AssignmentTest from "./pages/AssignmentTest.tsx";
import AssignmentResult from "./pages/AssignmentResult.tsx";
import PaymentStatus from "./pages/PaymentStatus.tsx";
import CyberCafeRegister from "./pages/CyberCafeRegister.tsx";
import CyberCafeDashboard from "./pages/CyberCafeDashboard.tsx";
import { VisitorTracker } from "./components/VisitorTracker";
import { ProtectedRoute } from "./components/ProtectedRoute";
import CollegeDashboard from "./pages/CollegeDashboard.tsx";
import ReferralPartnerDashboard from "./pages/ReferralPartnerDashboard.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <VisitorTracker />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/cybercafe/login" element={<Login />} />
          <Route path="/cyber-cafe/login" element={<Navigate to="/cybercafe/login" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/referrals" element={<Navigate to="/admin?tab=referrals" replace />} />
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <SuperAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/college/login" element={<Login />} />
          <Route
            path="/college/dashboard"
            element={
              <ProtectedRoute allowedRoles={["college_admin"]}>
                <CollegeDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/referral/login" element={<Login />} />
          <Route
            path="/referral/dashboard"
            element={
              <ProtectedRoute allowedRoles={["referral_partner"]}>
                <ReferralPartnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/benefits" element={<Benefits />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/assignment/:id" element={<AssignmentTest />} />
          <Route path="/assignment/:id/result" element={<AssignmentResult />} />
          <Route path="/payment-status" element={<PaymentStatus />} />
          <Route path="/cybercafe" element={<CyberCafeRegister />} />
          <Route
            path="/cybercafe/dashboard"
            element={
              <ProtectedRoute allowedRoles={["cybercafe"]}>
                <CyberCafeDashboard />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
