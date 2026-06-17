import { useEffect, useMemo, useState } from "react";
import { fetchAnalytics, fetchInventory } from "../api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<"7d" | "31d" | "12m">("31d");

  useEffect(() => {
    Promise.all([fetchAnalytics(), fetchInventory()])
      .then(([a, i]) => {
        setAnalytics(a);
        setInventory(i);
      })
      .catch(() => {
        setAnalytics(null);
      });
  }, []);

  const lowStock = useMemo(() => inventory.filter((item) => item.lowStock), [inventory]);

  // Prepare data for daily sales line chart
  const dailyLabels = useMemo(() => (analytics?.dailySales ?? []).map((r: any) => r.day).reverse(), [analytics]);
  const dailyData = useMemo(() => (analytics?.dailySales ?? []).map((r: any) => Number(r.total)).reverse(), [analytics]);
  const monthlyLabels = useMemo(() => (analytics?.monthlySales ?? []).map((r: any) => r.month).reverse(), [analytics]);
  const monthlyData = useMemo(() => (analytics?.monthlySales ?? []).map((r: any) => Number(r.total)).reverse(), [analytics]);

  // Totals: today, last 7 days, current month, current year
  const today = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const row = (analytics?.dailySales ?? []).find((r: any) => r.day === todayKey);
    return Number(row?.total ?? 0);
  }, [analytics]);

  const weekTotal = useMemo(() => {
    const ds = (analytics?.dailySales ?? []).map((r: any) => ({ day: r.day, total: Number(r.total) })).reverse();
    return ds.slice(-7).reduce((s: number, r: { day: string; total: number }) => s + r.total, 0);
  }, [analytics]);

  const monthTotal = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const m = (analytics?.monthlySales ?? []).find((r: any) => r.month === currentMonth);
    if (m) return Number(m.total);
    // fallback: sum daily entries for current month
    const ds = (analytics?.dailySales ?? []).filter((r: any) => r.day.startsWith(currentMonth)).map((r: any) => Number(r.total));
    return ds.reduce((s: number, v: number) => s + v, 0);
  }, [analytics]);

  const yearTotal = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ms = (analytics?.monthlySales ?? []).filter((r: any) => r.month.startsWith(String(currentYear))).map((r: any) => Number(r.total));
    if (ms.length) return ms.reduce((s: number, v: number) => s + v, 0);
    // fallback: sum all monthly
    return (analytics?.monthlySales ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
  }, [analytics]);

  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false }, title: { display: true, text: timeframe === "12m" ? "Ventes mensuelles (12 mois)" : timeframe === "7d" ? "Ventes (7 jours)" : "Ventes quotidiennes (31 jours)" } },
  };

  const lineDataset = useMemo(() => {
    if (timeframe === "12m") {
      return { labels: monthlyLabels, datasets: [{ label: "Ventes €", data: monthlyData, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.2)" }] };
    }
    const labels = timeframe === "7d" ? dailyLabels.slice(-7) : dailyLabels;
    const data = timeframe === "7d" ? dailyData.slice(-7) : dailyData;
    return { labels, datasets: [{ label: "Ventes €", data, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.2)" }] };
  }, [timeframe, dailyLabels, dailyData, monthlyLabels, monthlyData]);

  // Prepare data for popular products bar chart
  const popular = analytics?.popularProducts ?? [];
  const popularLabels = popular.map((p: any) => p.name).slice(0, 8);
  const popularCounts = popular.map((p: any) => Number(p.count)).slice(0, 8);

  const barOptions = {
    indexAxis: "y" as const,
    responsive: true,
    plugins: { legend: { display: false }, title: { display: true, text: "Produits les plus vendus" } },
  };

  const barDataset = {
    labels: popularLabels,
    datasets: [
      {
        label: "Quantité",
        data: popularCounts,
        backgroundColor: "#10b981",
      },
    ],
  };

  return (
    <section className="panel" style={{ maxWidth: 1200, margin: "1rem auto" }}>
      <div className="panel-header">
        <div>
          <h1>Dashboard SaaS</h1>
          <p className="tagline">Vue consolidée du restaurant, du stock et des ventes.</p>
        </div>
      </div>
      <div className="menu-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <article className="panel"><strong>Ventes total</strong><div style={{ fontSize: "1.6rem", marginTop: 8 }}>{analytics?.totalSales ?? 0} €</div></article>
        <article className="panel"><strong>Commandes</strong><div style={{ fontSize: "1.6rem", marginTop: 8 }}>{analytics?.ordersCount ?? 0}</div></article>
        <article className="panel"><strong>Panier moyen</strong><div style={{ fontSize: "1.6rem", marginTop: 8 }}>{analytics?.averageCart ?? 0} €</div></article>
        <article className="panel"><strong>Alertes stock</strong><div style={{ fontSize: "1.6rem", marginTop: 8 }}>{lowStock.length}</div></article>
      </div>

      <div className="menu-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginTop: "1rem" }}>
        <article className="panel" style={{ padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Aujourd'hui</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, marginTop: 6 }}>{today.toFixed(2)} €</div>
        </article>
        <article className="panel" style={{ padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Semaine</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, marginTop: 6 }}>{weekTotal.toFixed(2)} €</div>
        </article>
        <article className="panel" style={{ padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Mois</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, marginTop: 6 }}>{monthTotal.toFixed(2)} €</div>
        </article>
        <article className="panel" style={{ padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Année</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, marginTop: 6 }}>{yearTotal.toFixed(2)} €</div>
        </article>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
        <label className="field-label" style={{ margin: 0 }}>Période</label>
        <select className="field-input" value={timeframe} onChange={(e) => setTimeframe(e.target.value as any)} style={{ width: 180 }}>
          <option value="7d">7 jours</option>
          <option value="31d">31 jours</option>
          <option value="12m">12 mois</option>
        </select>
      </div>

      <div className="menu-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <article className="panel" style={{ padding: 12 }}>
          <Line options={lineOptions} data={lineDataset} />
        </article>
        <article className="panel" style={{ padding: 12 }}>
          <Bar options={barOptions} data={barDataset} />
        </article>
      </div>

      <div className="menu-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "1rem" }}>
        <article className="panel">
          <h2>Produits les plus vendus</h2>
          <ul>{(analytics?.popularProducts ?? []).slice(0, 6).map((item: any) => <li key={item.name}>{item.name} — {item.count}</li>)}</ul>
        </article>
        <article className="panel">
          <h2>Rupture / stock faible</h2>
          <ul>{lowStock.length ? lowStock.map((item) => <li key={item.id}>{item.name} ({item.stockQuantity} unités)</li>) : <li>Aucune alerte.</li>}</ul>
        </article>
      </div>
    </section>
  );
}
