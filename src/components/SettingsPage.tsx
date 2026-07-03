import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import {
  fetchSettingsAppearance,
  fetchSettingsBilling,
  fetchSettingsGeneral,
  fetchSettingsLanguageRegion,
  fetchSettingsNotifications,
  fetchTenantUsers,
  updateSettingsAppearance,
  updateSettingsBilling,
  updateSettingsGeneral,
  updateSettingsLanguageRegion,
  updateSettingsNotifications,
  updateTenantUserActive,
  updateTenantUserRole,
} from "../api";


type SectionKey = "general" | "language" | "appearance" | "notifications" | "billing" | "users";

type SettingsGeneral = {
  companyName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
};

type SettingsLanguageRegion = {
  language?: string;
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
};

type SettingsAppearance = {
  theme?: string;
  primaryColor?: string;
  logoUrl?: string;
};

type SettingsNotifications = {
  emailAlerts?: boolean;
  smsAlerts?: boolean;
  lowStockAlerts?: boolean;
  orderReadyAlerts?: boolean;
};

type SettingsBilling = {
  quoteEnabled?: boolean;
  quotePrefix?: string;
  invoicePrefix?: string;
  taxRate?: number;
  paymentTerms?: string;
  footer?: string;
};

type TenantUserRow = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};


const ROLE_ADMIN = new Set(["Super Admin", "Admin"]);

function canManageUsers(role?: string | null): boolean {
  if (!role) return false;
  return ROLE_ADMIN.has(role);
}

export default function SettingsPage() {
  const auth = useAuth();
  const role = auth.session?.role ?? null;

  const [activeSection, setActiveSection] = useState<SectionKey>("general");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [general, setGeneral] = useState<SettingsGeneral>({});
  const [languageRegion, setLanguageRegion] = useState<SettingsLanguageRegion>({});
  const [appearance, setAppearance] = useState<SettingsAppearance>({});
  const [notifications, setNotifications] = useState<SettingsNotifications>({});
  const [billing, setBilling] = useState<SettingsBilling>({});

  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [usersSaving, setUsersSaving] = useState<Record<string, boolean>>({});

  const canEditBasicSettings = useMemo(() => {
    return role === "Super Admin" || role === "Admin" || role === "Manager";
  }, [role]);

  const showAccessDenied = !canEditBasicSettings;

  function syncSessionRestaurantName(name?: string) {
    if (!auth.session) return;
    const nextName = name?.trim() || auth.session.restaurantName || "";
    if (nextName === auth.session.restaurantName) return;
    auth.login({ ...auth.session, restaurantName: nextName });
  }

  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseName = general.companyName?.trim() || "Restaurant POS";
    document.title = baseName;
  }, [general.companyName]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const primaryColor = appearance.primaryColor?.trim() || "#c45c26";
    const theme = appearance.theme === "dark" ? "dark" : "light";
    document.documentElement.style.setProperty("--accent", primaryColor);
    document.documentElement.setAttribute("data-theme", theme);
  }, [appearance.primaryColor, appearance.theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [g, l, a, n, b] = await Promise.all([
          fetchSettingsGeneral(),
          fetchSettingsLanguageRegion(),
          fetchSettingsAppearance(),
          fetchSettingsNotifications(),
          fetchSettingsBilling(),
        ]);
        if (cancelled) return;
        setGeneral(g);
        setLanguageRegion(l);
        setAppearance(a);
        setNotifications(n);
        setBilling(b);
        syncSessionRestaurantName(g.companyName);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Impossible de charger les paramètres");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "users") return;
    if (!canManageUsers(role)) return;

    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const list = await fetchTenantUsers();
        if (cancelled) return;
        setUsers(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Impossible de charger les utilisateurs");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSection, role]);

  const sections: Array<{ key: SectionKey; label: string; hide?: boolean }> = [
    { key: "general", label: "General" },
    { key: "language", label: "Language & Region" },
    { key: "appearance", label: "Appearance" },
    { key: "notifications", label: "Notifications" },
    { key: "billing", label: "Billing & Quotes" },
    { key: "users", label: "Users", hide: !canManageUsers(role) },
  ];

  async function saveGeneral() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateSettingsGeneral(general);
      setGeneral(next);
      syncSessionRestaurantName(next.companyName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer les paramètres");
    } finally {
      setSaving(false);
    }
  }

  async function saveLanguageRegion() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateSettingsLanguageRegion(languageRegion);
      setLanguageRegion(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer les paramètres");
    } finally {
      setSaving(false);
    }
  }

  async function saveAppearance() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateSettingsAppearance(appearance);
      setAppearance(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer les paramètres");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotifications() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateSettingsNotifications(notifications);
      setNotifications(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer les paramètres");
    } finally {
      setSaving(false);
    }
  }

  async function saveBilling() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateSettingsBilling(billing);
      setBilling(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer les paramètres");
    } finally {
      setSaving(false);
    }
  }

  async function setUserRole(userId: string, nextRole: string) {
    setUsersSaving((m) => ({ ...m, [userId]: true }));
    setError(null);
    try {
      await updateTenantUserRole(userId, nextRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de mettre à jour le rôle");
    } finally {
      setUsersSaving((m) => ({ ...m, [userId]: false }));
    }
  }

  async function setUserActive(userId: string, isActive: boolean) {
    setUsersSaving((m) => ({ ...m, [userId]: true }));
    setError(null);
    try {
      await updateTenantUserActive(userId, isActive);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de mettre à jour l'utilisateur");
    } finally {
      setUsersSaving((m) => ({ ...m, [userId]: false }));
    }
  }

  const roleOptions = useMemo(() => {
    // keep in sync with backend allowed role list
    return ["Super Admin", "Admin", "Manager", "Serveur", "Cuisine", "Caissier"];
  }, []);

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>

        {showAccessDenied ? (
          <div className="bg-red-600/10 border border-red-600 rounded p-4 text-red-700">
            Accès refusé.
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-600/10 border border-red-600 rounded p-4 text-red-700 mt-4">{error}</div>
        ) : null}

        <div className="grid grid-cols-12 gap-6 mt-6">
          <aside className="col-span-12 md:col-span-3">
            <div className="bg-surface-900 border border-white/10 rounded p-3">
              <div className="font-medium mb-3">Sections</div>
              <div className="space-y-1">
                {sections
                  .filter((s) => !s.hide)
                  .map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActiveSection(s.key)}
                      className={
                        activeSection === s.key
                          ? "w-full text-left px-3 py-2 rounded bg-blue-600/20 text-blue-700 font-medium"
                          : "w-full text-left px-3 py-2 rounded hover:bg-blue-600/10"
                      }
                      disabled={loading || usersLoading}
                    >
                      {s.label}
                    </button>
                  ))}
              </div>
            </div>
          </aside>

          <section className="col-span-12 md:col-span-9">
            {loading ? (
              <div className="bg-surface-900 border border-white/10 rounded p-4">Chargement...</div>
            ) : null}

            {!loading && activeSection === "general" ? (
              <div className="bg-surface-900 border border-white/10 rounded p-5">
                <div className="text-lg font-semibold mb-4">General</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <div className="text-sm mb-1">Company name</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={general.companyName ?? ""}
                      onChange={(e) => setGeneral((g) => ({ ...g, companyName: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Logo URL</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={general.logoUrl ?? ""}
                      onChange={(e) => setGeneral((g) => ({ ...g, logoUrl: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm mb-1">Address</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={general.address ?? ""}
                      onChange={(e) => setGeneral((g) => ({ ...g, address: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Phone</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={general.phone ?? ""}
                      onChange={(e) => setGeneral((g) => ({ ...g, phone: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Email</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={general.email ?? ""}
                      onChange={(e) => setGeneral((g) => ({ ...g, email: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm mb-1">Website</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={general.website ?? ""}
                      onChange={(e) => setGeneral((g) => ({ ...g, website: e.target.value }))}
                      disabled={saving}
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveGeneral}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && activeSection === "language" ? (
              <div className="bg-surface-900 border border-white/10 rounded p-5">
                <div className="text-lg font-semibold mb-4">Language & Region</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <div className="text-sm mb-1">Language</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={languageRegion.language ?? ""}
                      onChange={(e) => setLanguageRegion((l) => ({ ...l, language: e.target.value }))}
                      disabled={saving}
                      placeholder="fr, en, ar"
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Currency</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={languageRegion.currency ?? ""}
                      onChange={(e) => setLanguageRegion((l) => ({ ...l, currency: e.target.value }))}
                      disabled={saving}
                      placeholder="MAD, EUR, USD"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm mb-1">Timezone</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={languageRegion.timezone ?? ""}
                      onChange={(e) => setLanguageRegion((l) => ({ ...l, timezone: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Date format</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={languageRegion.dateFormat ?? ""}
                      onChange={(e) => setLanguageRegion((l) => ({ ...l, dateFormat: e.target.value }))}
                      disabled={saving}
                      placeholder="DD/MM/YYYY"
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Time format</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={languageRegion.timeFormat ?? ""}
                      onChange={(e) => setLanguageRegion((l) => ({ ...l, timeFormat: e.target.value }))}
                      disabled={saving}
                      placeholder="24h, 12h"
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveLanguageRegion}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && activeSection === "appearance" ? (
              <div className="bg-surface-900 border border-white/10 rounded p-5">
                <div className="text-lg font-semibold mb-4">Appearance</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <div className="text-sm mb-1">Theme</div>
                    <select
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={appearance.theme ?? ""}
                      onChange={(e) => setAppearance((a) => ({ ...a, theme: e.target.value }))}
                      disabled={saving}
                    >
                      <option value="light">light</option>
                      <option value="dark">dark</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Primary color</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={appearance.primaryColor ?? ""}
                      onChange={(e) => setAppearance((a) => ({ ...a, primaryColor: e.target.value }))}
                      disabled={saving}
                      placeholder="#2563eb"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm mb-1">Logo URL (override)</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={appearance.logoUrl ?? ""}
                      onChange={(e) => setAppearance((a) => ({ ...a, logoUrl: e.target.value }))}
                      disabled={saving}
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveAppearance}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && activeSection === "notifications" ? (
              <div className="bg-surface-900 border border-white/10 rounded p-5">
                <div className="text-lg font-semibold mb-4">Notifications</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifications.emailAlerts ?? false}
                      onChange={(e) => setNotifications((n) => ({ ...n, emailAlerts: e.target.checked }))}
                      disabled={saving}
                    />
                    <span>Email alerts</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifications.smsAlerts ?? false}
                      onChange={(e) => setNotifications((n) => ({ ...n, smsAlerts: e.target.checked }))}
                      disabled={saving}
                    />
                    <span>SMS alerts</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifications.lowStockAlerts ?? false}
                      onChange={(e) => setNotifications((n) => ({ ...n, lowStockAlerts: e.target.checked }))}
                      disabled={saving}
                    />
                    <span>Low stock alerts</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notifications.orderReadyAlerts ?? false}
                      onChange={(e) => setNotifications((n) => ({ ...n, orderReadyAlerts: e.target.checked }))}
                      disabled={saving}
                    />
                    <span>Order ready alerts</span>
                  </label>
                </div>

                <div className="mt-5 flex justify-end">
                  <button type="button" className="btn-primary" onClick={saveNotifications} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && activeSection === "billing" ? (
              <div className="bg-surface-900 border border-white/10 rounded p-5">
                <div className="text-lg font-semibold mb-4">Billing & Quotes</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={billing.quoteEnabled ?? false}
                      onChange={(e) => setBilling((b) => ({ ...b, quoteEnabled: e.target.checked }))}
                      disabled={saving}
                    />
                    <span>Enable quotes</span>
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Quote prefix</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={billing.quotePrefix ?? ""}
                      onChange={(e) => setBilling((b) => ({ ...b, quotePrefix: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Invoice prefix</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={billing.invoicePrefix ?? ""}
                      onChange={(e) => setBilling((b) => ({ ...b, invoicePrefix: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Tax rate (%)</div>
                    <input
                      type="number"
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={billing.taxRate ?? 0}
                      onChange={(e) => setBilling((b) => ({ ...b, taxRate: Number(e.target.value) }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-sm mb-1">Payment terms</div>
                    <input
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={billing.paymentTerms ?? ""}
                      onChange={(e) => setBilling((b) => ({ ...b, paymentTerms: e.target.value }))}
                      disabled={saving}
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-sm mb-1">Footer</div>
                    <textarea
                      className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                      value={billing.footer ?? ""}
                      onChange={(e) => setBilling((b) => ({ ...b, footer: e.target.value }))}
                      disabled={saving}
                      rows={3}
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end">
                  <button type="button" className="btn-primary" onClick={saveBilling} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && activeSection === "users" ? (
              <div className="bg-surface-900 border border-white/10 rounded p-5">
                <div className="text-lg font-semibold mb-4">Users</div>

                {usersLoading ? <div>Chargement...</div> : null}

                {!usersLoading ? (
                  <div className="space-y-3">
                    {users.map((u) => (
                      <div key={u.id} className="border border-white/10 rounded p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{u.firstName} {u.lastName}</div>
                            <div className="text-sm text-white/60">{u.email}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={u.isActive}
                                onChange={(e) => setUserActive(u.id, e.target.checked)}
                                disabled={!!usersSaving[u.id]}
                              />
                              Active
                            </label>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                          <div>
                            <div className="text-sm mb-1">Role</div>
                            <select
                              className="w-full bg-surface-800 border border-white/10 rounded px-3 py-2"
                              value={u.role}
                              onChange={(e) => setUserRole(u.id, e.target.value)}
                              disabled={!!usersSaving[u.id]}
                            >
                              {roleOptions.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          <div className="text-sm text-white/60">
                            {usersSaving[u.id] ? "Saving..." : null}
                          </div>
                        </div>
                      </div>
                    ))}

                    {users.length === 0 ? (
                      <div className="text-white/60">No users.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

