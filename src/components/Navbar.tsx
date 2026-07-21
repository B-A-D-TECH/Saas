// ...existing code...
import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Navbar() {
  const auth = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-left">
        <ul className="nav-list">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/Caisse" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Caisse
            </NavLink>
          </li>
          <li>
            <NavLink to="/Commandes" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Commandes
            </NavLink>
          </li>
          <li>
            <NavLink to="/inventory" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              recette disponible
            </NavLink>
          </li>
          <li>
            <NavLink to="/suppliers" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Fournisseurs
            </NavLink>
          </li>
          <li>
            <NavLink to="/purchases" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Achats
            </NavLink>
          </li>
          <li>
            <NavLink to="/stock-history" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Historique
            </NavLink>
          </li>
          <li>
            <NavLink to="/products" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Plats
            </NavLink>
          </li>
          <li>
            <NavLink to="/categories" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Catégories
            </NavLink>
          </li>
          <li>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              Paramètres
            </NavLink>
          </li>

        </ul>
      </div>
      <div className="nav-right">
        <div className="nav-meta">
          <span>{auth.session?.restaurantName}</span>
          <span className="nav-user">{auth.session?.email}</span>
        </div>
        <button type="button" className="btn-secondary nav-logout" onClick={auth.logout}>
          Déconnexion
        </button>
      </div>
    </nav>
  );
}
// ...existing code...