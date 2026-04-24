import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import BillsPage from "@/pages/Bills";
import BillDetailPage from "@/pages/BillDetail";
import AddBillPage from "@/pages/AddBill";
import ApproveBillPage from "@/pages/ApproveBill";
import RequestEditPage from "@/pages/RequestEdit";
import VersionsPage from "@/pages/Versions";
import CommoditiesPage from "@/pages/Commodities";
import DepositorsPage from "@/pages/Depositors";
import UsersPage from "@/pages/Users";
import ProfilePage from "@/pages/Profile";
import ReportsPage from "@/pages/Reports";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

function RequireAuth({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading, token } = useAuth();

  if (!token) return <Redirect to="/login" />;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  if (adminOnly && user.role !== "admin") return <Redirect to="/bills" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, token } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/">
        {token ? (user?.role === "admin" ? <Redirect to="/dashboard" /> : <Redirect to="/bills" />) : <Redirect to="/login" />}
      </Route>
      <Route path="/dashboard">
        <RequireAuth adminOnly><DashboardPage /></RequireAuth>
      </Route>
      <Route path="/bills">
        <RequireAuth><BillsPage /></RequireAuth>
      </Route>
      <Route path="/bills/new">
        <RequireAuth><AddBillPage /></RequireAuth>
      </Route>
      <Route path="/bills/:id/approve">
        <RequireAuth adminOnly><ApproveBillPage /></RequireAuth>
      </Route>
      <Route path="/bills/:id/request-edit">
        <RequireAuth><RequestEditPage /></RequireAuth>
      </Route>
      <Route path="/bills/:id">
        <RequireAuth><BillDetailPage /></RequireAuth>
      </Route>
      <Route path="/commodities">
        <RequireAuth adminOnly><CommoditiesPage /></RequireAuth>
      </Route>
      <Route path="/depositors">
        <RequireAuth adminOnly><DepositorsPage /></RequireAuth>
      </Route>
      <Route path="/users">
        <RequireAuth adminOnly><UsersPage /></RequireAuth>
      </Route>
      <Route path="/versions">
        <RequireAuth adminOnly><VersionsPage /></RequireAuth>
      </Route>
      <Route path="/reports">
        <RequireAuth adminOnly><ReportsPage /></RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth><ProfilePage /></RequireAuth>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
