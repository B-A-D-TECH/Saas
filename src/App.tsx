import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

import Navbar from "./components/Navbar";
import Login from "./components/Login";
import { Caisse } from "./components/Caisse";
import { Commandes } from "./components/Commandes";
import Client from "./components/Client";
import Products from "./components/Products";
import ProductForm from "./components/ProductForm";
import Categories from "./components/Categories";
import Dashboard from "./components/Dashboard";
import InventoryPage from "./components/InventoryPage";
import SuppliersPage from "./components/SuppliersPage";
import PurchasesPage from "./components/PurchasesPage";
import StockHistoryPage from "./components/StockHistoryPage";
import SettingsPage from "./components/SettingsPage";


function RequireAuth({ children }: { children: ReactNode }) {

  const auth = useAuth();
  const location = useLocation();
  if (!auth.session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-surface-800 flex flex-col">
      {auth.session ? <Navbar /> : null}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to={auth.session ? "/Caisse" : "/login"} replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/client" element={<Client />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/Caisse" element={<RequireAuth><Caisse /></RequireAuth>} />
          <Route path="/Commandes" element={<RequireAuth><Commandes /></RequireAuth>} />
          <Route path="/products" element={<RequireAuth><Products /></RequireAuth>} />
          <Route path="/products/new" element={<RequireAuth><ProductForm /></RequireAuth>} />
          <Route path="/products/:id/edit" element={<RequireAuth><ProductForm /></RequireAuth>} />
          <Route path="/categories" element={<RequireAuth><Categories /></RequireAuth>} />
          <Route path="/inventory" element={<RequireAuth><InventoryPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

          <Route path="/suppliers" element={<RequireAuth><SuppliersPage /></RequireAuth>} />
          <Route path="/purchases" element={<RequireAuth><PurchasesPage /></RequireAuth>} />
          <Route path="/stock-history" element={<RequireAuth><StockHistoryPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
