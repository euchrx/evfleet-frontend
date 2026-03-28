import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { DashboardPage } from "../pages/Dashboard";
import { LoginPage } from "../pages/Login";
import { UsersPage } from "../pages/Users";
import { CompaniesPage } from "../pages/Companies";
import { VehiclesPage } from "../pages/Vehicles";
import { DriversPage } from "../pages/Drivers";
import { MaintenanceRecordsPage } from "../pages/MaintenanceRecords";
import { MaintenanceRegisterPage } from "../pages/MaintenanceRegister";
import { DebtsPage } from "../pages/Debts";
import { BranchesPage } from "../pages/Branches";
import { ReportsPage } from "../pages/Reports";
import { FuelRecordsPage } from "../pages/FuelRecords";
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
        <Route path="/login" element={<LoginPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/maintenance-records" element={<MaintenanceRecordsPage />} />
            <Route path="/maintenance-records/register" element={<MaintenanceRegisterPage />} />
            <Route path="/fuel-records" element={<FuelRecordsPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/vehicle-documents" element={<VehicleDocumentsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/billing/success" element={<BillingSuccessPage />} />
            <Route path="/how-to-use" element={<HowToPage />} />

            <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/administration" element={<AdministrationPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
