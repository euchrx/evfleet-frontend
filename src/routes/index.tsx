import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { LandingPage } from "../pages/Landing";
import { DashboardPage } from "../pages/Dashboard";
import { LoginPage } from "../pages/Login";
import { TermsPage } from "../pages/Terms";
import { PrivacyPage } from "../pages/Privacy";
import { UsersPage } from "../pages/Users";
import { CompaniesPage } from "../pages/Companies";
import { BranchesPage } from "../pages/Branches";
import { VehiclesPage } from "../pages/Vehicles";
import { DriversPage } from "../pages/Drivers";
import { MaintenanceRecordsPage } from "../pages/MaintenanceRecords";
import { MaintenanceRegisterPage } from "../pages/MaintenanceRegister";
import { TireManagementPage } from "../pages/TireManagement";
import { TireLinkPage } from "../pages/TireManagement/TireLinkPage";
import { DebtsPage } from "../pages/Debts";
import { ReportsPage } from "../pages/Reports";
import { FuelRecordsPage } from "../pages/FuelRecords";
import { RetailProductsPage } from "../pages/RetailProducts";
import { SupportPage } from "../pages/Support";
import { AdministrationPage } from "../pages/Administration";
import { TripsPage } from "../pages/Trips";
import { VehicleDocumentsPage } from "../pages/VehicleDocuments";
import { HowToPage } from "../pages/HowTo";
import { SubscriptionPage } from "../pages/Subscription";
import { BillingSuccessPage } from "../pages/BillingSuccess";
import { PrivateRoute } from "./PrivateRoute";
import { RoleRoute } from "./RoleRoute";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/maintenance-records" element={<MaintenanceRecordsPage />} />
            <Route path="/maintenance-records/register" element={<MaintenanceRegisterPage />} />
            <Route path="/tire-management" element={<TireManagementPage />} />
            <Route path="/tire-management/link" element={<TireLinkPage />} />
            <Route path="/fuel-records" element={<FuelRecordsPage />} />
            <Route path="/products" element={<RetailProductsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/retail-products" element={<Navigate to="/products" replace />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/vehicle-documents" element={<VehicleDocumentsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/billing/success" element={<BillingSuccessPage />} />
            <Route path="/how-to-use" element={<HowToPage />} />

            <Route element={<RoleRoute allowedRoles={["ADMIN", "FLEET_MANAGER"]} />}>
              <Route path="/branches" element={<BranchesPage />} />
            </Route>

            <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/finance" element={<Navigate to="/companies" replace />} />
              <Route path="/administration" element={<AdministrationPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}