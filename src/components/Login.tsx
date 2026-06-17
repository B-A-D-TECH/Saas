import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginUser, registerUser } from "../api";
import { useAuth } from "../AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/Caisse";

  useEffect(() => {
    if (auth.session) {
      navigate(from, { replace: true });
    }
  }, [auth.session, from, navigate]);

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length >= 8 &&
    (mode === "login"
      ? true
      : companyName.trim().length >= 3 && firstName.trim().length >= 2 && lastName.trim().length >= 2);

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await loginUser({ email: email.trim().toLowerCase(), password });
      } else {
        result = await registerUser({
          companyName: companyName.trim(),
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      }

      auth.login({
        token: result.token,
        userId: result.user.id,
        tenantId: result.user.tenantId,
        restaurantId: result.user.tenantId,
        restaurantName: result.user.tenantName,
        email: result.user.email,
        role: result.user.role,
      }, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de se connecter");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-root" style={{ justifyContent: "center", alignItems: "center", padding: "2rem 1rem" }}>
      <section className="panel" style={{ maxWidth: "520px", width: "100%" }}>
        <header className="panel-header">
          <div>
            <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
            <p className="tagline">
              {mode === "login"
                ? "Connectez-vous à votre restaurant SaaS."
                : "Créez un restaurant, un compte et commencez votre gestion."}
            </p>
          </div>
        </header>

        {error ? <p className="app-banner app-banner-error">{error}</p> : null}

        <div style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setMode((current) => (current === "login" ? "register" : "login"));
                setError(null);
              }}
            >
              {mode === "login" ? "Créer un nouveau compte" : "Se connecter"}
            </button>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              {mode === "login"
                ? "Entrez votre email et votre mot de passe pour accéder à votre tableau de bord."
                : "Vous créez un restaurant SaaS et un super administrateur."}
            </span>
          </div>

          {mode === "register" ? (
            <>
              <label className="field-label" htmlFor="companyName">
                Nom du restaurant
              </label>
              <input
                id="companyName"
                className="field-input"
                value={companyName}
                placeholder="ex. La Table Provençale"
                onChange={(event) => setCompanyName(event.target.value)}
              />

              <label className="field-label" htmlFor="firstName">
                Prénom
              </label>
              <input
                id="firstName"
                className="field-input"
                value={firstName}
                placeholder="ex. Julie"
                onChange={(event) => setFirstName(event.target.value)}
              />

              <label className="field-label" htmlFor="lastName">
                Nom
              </label>
              <input
                id="lastName"
                className="field-input"
                value={lastName}
                placeholder="ex. Martin"
                onChange={(event) => setLastName(event.target.value)}
              />
            </>
          ) : null}

          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="field-input"
            type="email"
            value={email}
            placeholder="ex. julie@restaurant.com"
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />

          <label className="field-label" htmlFor="password">
            Mot de passe
          </label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              id="password"
              className="field-input"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="••••••••"
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-ghost" onClick={() => setShowPassword((s) => !s)} style={{ height: 40 }}>
              {showPassword ? "Cacher" : "Montrer"}
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Se souvenir de moi
          </label>

          <button
            type="button"
            className="btn-primary"
            disabled={!canSubmit || loading}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Chargement…" : mode === "login" ? "Se connecter" : "Créer le compte"}
          </button>
        </div>
      </section>
    </div>
  );
}
