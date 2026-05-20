import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/contexts/RoleContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PanicAlertsProvider } from "@/contexts/PanicAlertsContext";
import Chatbot from "@/components/Chatbot";
import PanicNotifier from "@/components/PanicNotifier";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AnimatePresence, motion } from "framer-motion";
import Index from "./pages/Index.tsx";
import WorkerPage from "./pages/WorkerPage.tsx";
import WorkerProfilePage from "./pages/WorkerProfilePage.tsx";
import EmployerPage from "./pages/EmployerPage.tsx";
import SearchPage from "./pages/SearchPage.tsx";
import IncidentPage from "./pages/IncidentPage.tsx";
import NewIncidentPage from "./pages/NewIncidentPage.tsx";
import EntryReportPage from "./pages/EntryReportPage.tsx";
import ExpiryReportPage from "./pages/ExpiryReportPage.tsx";
import PlaceholderPage from "./pages/PlaceholderPage.tsx";
import PricingPage from "./pages/PricingPage.tsx";
import AttendancePage from "./pages/AttendancePage";
import LeavePage from "./pages/LeavePage";
import PayrollPage from "./pages/PayrollPage";
import ContractsPage from "./pages/ContractsPage";
import RosterPage from "./pages/RosterPage";
import TimesheetsPage from "./pages/TimesheetsPage";
import BroadcastPage from "./pages/BroadcastPage";
import HrmsRequestsPage from "./pages/HrmsRequestsPage";
import HrmsReportPage from "./pages/HrmsReportPage";
import WorkerHrmsRequestsPage from "./pages/WorkerHrmsRequestsPage";
import HrmsHomePage from "./pages/HrmsHomePage";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import WorkerLogin from "./pages/WorkerLogin.tsx";
import EmployerLogin from "./pages/EmployerLogin.tsx";
import AgencyLogin from "./pages/AgencyLogin.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import EmbassyLogin from "./pages/EmbassyLogin.tsx";
import LabourLogin from "./pages/LabourLogin.tsx";
import WorkerSignup from "./pages/WorkerSignup.tsx";
import EmployerSignup from "./pages/EmployerSignup.tsx";
import AgencySignup from "./pages/AgencySignup.tsx";
import EmbassySignup from "./pages/EmbassySignup.tsx";
import LabourSignup from "./pages/LabourSignup.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AttestationPage from "./pages/AttestationPage.tsx";
import LiveMapPage from "./pages/LiveMapPage.tsx";
import AlertDetailPage from "./pages/AlertDetailPage.tsx";
import WorkerAttestationSubmitPage from "./pages/WorkerAttestationSubmitPage.tsx";
import BlogPage from "./pages/BlogPage.tsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";
import DisputePage from "./pages/DisputePage.tsx";
import CompleteProfilePage from "./pages/CompleteProfilePage.tsx";
import ComplianceDashboardPage from "./pages/ComplianceDashboardPage.tsx";
import RiskDashboardPage from "./pages/RiskDashboardPage.tsx";
import BulkImportPage from "./pages/BulkImportPage.tsx";
import EmbassyDashboardPage from "./pages/EmbassyDashboardPage.tsx";
import LabourDashboardPage from "./pages/LabourDashboardPage.tsx";
import NotificationSettingsPage from "./pages/NotificationSettingsPage.tsx";
import CopilotPage from "./pages/CopilotPage.tsx";
import RequireCompleteProfile from "@/components/RequireCompleteProfile";

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/dashboard" element={
              <ProtectedRoute allow={["admin", "agency", "employer", "worker", "embassy_source", "embassy_destination", "labour"]}>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/login/worker" element={<WorkerLogin />} />
          <Route path="/login/employer" element={<EmployerLogin />} />
          <Route path="/login/agency" element={<AgencyLogin />} />
          <Route path="/login/embassy-source" element={<EmbassyLogin variant="source" />} />
          <Route path="/login/embassy-destination" element={<EmbassyLogin variant="destination" />} />
          <Route path="/login/labour" element={<LabourLogin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup/worker" element={<WorkerSignup />} />
          <Route path="/signup/employer" element={<EmployerSignup />} />
          <Route path="/signup/agency" element={<AgencySignup />} />
          <Route path="/signup/embassy-source" element={<EmbassySignup variant="source" />} />
          <Route path="/signup/embassy-destination" element={<EmbassySignup variant="destination" />} />
          <Route path="/signup/labour" element={<LabourSignup />} />
          <Route
            path="/admin/live-alerts"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live-map"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "embassy_source", "embassy_destination", "labour"]}>
                <LiveMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "embassy_source", "embassy_destination", "labour"]}>
                <AlertDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer"
            element={
              <ProtectedRoute allow={["admin", "agency"]}>
                <EmployerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/worker"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <WorkerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/worker/:workerId"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <WorkerProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/risk-dashboard"
            element={
              <ProtectedRoute allow={["admin", "agency"]}>
                <RiskDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bulk-import"
            element={
              <ProtectedRoute allow={["agency"]}>
                <BulkImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/embassy-dashboard"
            element={
              <ProtectedRoute allow={["embassy_source", "embassy_destination"]}>
                <EmbassyDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/labour-dashboard"
            element={
              <ProtectedRoute allow={["labour"]}>
                <LabourDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notification-settings"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "worker"]}>
                <NotificationSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/copilot"
            element={
              <ProtectedRoute allow={["admin", "agency"]}>
                <CopilotPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attestation"
            element={
              <ProtectedRoute allow={["admin", "agency"]}>
                <AttestationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute allow={["admin", "agency", "embassy_source", "embassy_destination", "labour"]}>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <ProtectedRoute allow={["agency", "employer"]}>
                <PricingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "worker"]}>
                <HrmsHomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/attendance"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/leave"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "worker"]}>
                <LeavePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/my-requests"
            element={
              <ProtectedRoute allow={["worker"]}>
                <WorkerHrmsRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/payroll"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <PayrollPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/contracts"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <ContractsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/roster"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <RosterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/timesheets"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <TimesheetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/requests"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <HrmsRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms/report"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer"]}>
                <HrmsReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/broadcast"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "worker", "embassy_source", "embassy_destination", "labour"]}>
                <BroadcastPage />
              </ProtectedRoute>
            }
          />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/dispute"
            element={
              <ProtectedRoute allow={["admin", "agency", "employer", "worker", "labour"]}>
                <DisputePage />
              </ProtectedRoute>
            }
          />
          <Route path="/incident/new" element={<NewIncidentPage />} />
          <Route path="/incident/:id" element={<IncidentPage />} />
          <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
          <Route path="/reports/entry" element={<EntryReportPage />} />
          <Route path="/reports/insurance" element={<ExpiryReportPage />} />
          <Route path="/reports/visa" element={<ExpiryReportPage />} />
          <Route path="/reports/problem" element={<PlaceholderPage title="Problem Report" />} />
          <Route path="/reports/user-entry" element={<PlaceholderPage title="User Entry Report" />} />
          <Route
            path="/compliance"
            element={
              <ProtectedRoute allow={["admin", "agency"]}>
                <ComplianceDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allow={["admin"]}>
                <PlaceholderPage title="Users" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/administration"
            element={
              <ProtectedRoute allow={["admin"]}>
                <PlaceholderPage title="Administration" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-documents"
            element={
              <ProtectedRoute allow={["worker"]}>
                <WorkerAttestationSubmitPage />
              </ProtectedRoute>
            }
          />
          <Route path="/panic-status" element={<PlaceholderPage title="Panic Status" />} />

          {/* QA-friendly route aliases so Playwright tests can use common URLs */}
          <Route path="/documents" element={<Navigate to="/my-documents" replace />} />
          <Route path="/leaves" element={<Navigate to="/hrms/leave" replace />} />
          <Route path="/clock" element={<Navigate to="/hrms" replace />} />
          <Route path="/roster" element={<Navigate to="/hrms/roster" replace />} />
          <Route path="/payslips" element={<Navigate to="/hrms/my-requests" replace />} />
          <Route path="/agency/employers" element={<Navigate to="/employer" replace />} />
          <Route path="/employer/workers" element={<Navigate to="/worker" replace />} />
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/profile" element={<Navigate to="/account" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RoleProvider>
      <AuthProvider>
      <PanicAlertsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RequireCompleteProfile>
            <AnimatedRoutes />
          </RequireCompleteProfile>

          <PanicNotifier />
          <Chatbot />
        </BrowserRouter>
      </TooltipProvider>
      </PanicAlertsProvider>
      </AuthProvider>
    </RoleProvider>
  </QueryClientProvider>
);

export default App;
