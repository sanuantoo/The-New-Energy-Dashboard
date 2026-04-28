import { useRef } from "react";
import "./App.css";
import OpenLayersMap from "./components/OpenLayersMap";

const filters = [
    { label: "Default Workspace", icon: "▣" },
    { label: "munich", icon: "◫" },
    { label: "Munich, Bavaria, Germany", icon: "⌖" },
    { label: "12/1/2025 - 12/31/2025", icon: "🗓" },
    { label: "60h resolution", icon: "◔" },
];

const statusBadges = [
    { label: "Converged", tone: "success" },
    { label: "Completed", tone: "done" },
];

const kpis = [
    { icon: "⚡", title: "Total Demand", value: "45.19 MWh", note: "over 30 days" },
    { icon: "☼", title: "Renewable Gen.", value: "0.0 kWh", note: "over 30 days" },
    { icon: "⇄", title: "Grid Import", value: "45.19 MWh", note: "over 30 days" },
    { icon: "↗", title: "Self-Sufficiency", value: "0.0%", note: "% of demand met by renewables" },
    { icon: "◠", title: "Peak Demand", value: "115.1 kW", note: "maximum site demand" },
    { icon: "€", title: "Total Cost", value: "€14.292", note: "Equipment + Running Costs" },
];

const tabs = ["Overview", "Energy", "Cost", "Grid", "System"];

const gauges = [
    { label: "Self-Consumption", value: 0, color: "#12b981" },
    { label: "Grid Independence", value: 0, color: "#3b82f6" },
    { label: "Capacity Factor", value: 0, color: "#8b5cf6" },
    { label: "CO₂ Reduction", value: 0, color: "#22c55e" },
];

const technology = [
    { name: "Solar", capacity: 106, factor: 0, color: "#4f83f1" },
    { name: "Battery", capacity: 18, factor: 0, color: "#8b5cf6" },
    { name: "EV", capacity: 0, factor: 0, color: "#14b8a6" },
    { name: "Backup", capacity: 0, factor: 0, color: "#94a3b8" },
];

const costSegments = [
    { label: "Grid", value: 62, color: "#6b7280" },
    { label: "Demand Charges", value: 18, color: "#81889a" },
    { label: "Equipment", value: 12, color: "#9ca3af" },
    { label: "Service", value: 8, color: "#c7cdd8" },
];

const assetStats = [
    { label: "Buildings", value: "8" },
    { label: "Technologies", value: "3" },
    { label: "Meters", value: "14" },
    { label: "Alerts", value: "2" },
];

const events = [
    { tone: "warning", text: "No renewable generation detected during selected period." },
    { tone: "info", text: "Grid import covered full site demand for this dataset." },
    { tone: "success", text: "Simulation completed successfully and converged." },
];

function App() {
    const mapRef = useRef(null);

    const donutStyle = {
        background: `conic-gradient(
      ${costSegments[0].color} 0% 62%,
      ${costSegments[1].color} 62% 80%,
      ${costSegments[2].color} 80% 92%,
      ${costSegments[3].color} 92% 100%
    )`,
    };

    return (
        <main className="energy-home">
            <header className="toolbar">
                <div className="toolbar-left">
                    {filters.map((item) => (
                        <div className="toolbar-chip" key={item.label}>
                            <span className="chip-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>

                <div className="toolbar-right">
                    {statusBadges.map((badge) => (
                        <div className={`status-badge ${badge.tone}`} key={badge.label}>
                            {badge.label}
                        </div>
                    ))}
                </div>
            </header>

            <section className="kpi-row">
                {kpis.map((item) => (
                    <article className="kpi-card-2" key={item.title}>
                        <div className="kpi-icon">{item.icon}</div>
                        <div>
                            <p>{item.title}</p>
                            <h3>{item.value}</h3>
                            <span>{item.note}</span>
                        </div>
                    </article>
                ))}
            </section>

            <section className="main-layout">
                <article className="panel map-panel">
                    <div className="map-hint">Click on a building to view details</div>

                    <div className="map-controls">
                        <button type="button" onClick={() => mapRef.current?.zoomIn()}>＋</button>
                        <button type="button" onClick={() => mapRef.current?.zoomOut()}>－</button>
                        <button type="button" onClick={() => mapRef.current?.resetView()}>◎</button>
                    </div>

                    <OpenLayersMap ref={mapRef} />
                </article>

                <div className="content-stack">
                    <article className="panel">
                        <div className="section-top">
                            <nav className="tab-row">
                                {tabs.map((tab, index) => (
                                    <button
                                        type="button"
                                        className={`tab-btn ${index === 0 ? "active" : ""}`}
                                        key={tab}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>

                            <div className="mini-stats">
                                <span>🏢 8</span>
                                <span>🧰 3</span>
                            </div>
                        </div>

                        <div className="gauge-grid">
                            {gauges.map((gauge) => (
                                <div className="gauge-card" key={gauge.label}>
                                    <div
                                        className="semi-gauge"
                                        style={{
                                            "--value": `${gauge.value}`,
                                            "--gauge-color": gauge.color,
                                        }}
                                    >
                                        <div className="semi-gauge-inner">
                                            <strong>{gauge.value}%</strong>
                                        </div>
                                    </div>
                                    <p>{gauge.label}</p>
                                </div>
                            ))}
                        </div>
                    </article>

                    <div className="lower-grid">
                        <article className="panel">
                            <div className="panel-head">
                                <h3>Technology Capacity</h3>
                                <span className="info-dot">i</span>
                            </div>

                            <div className="tech-meta">
                                <span>Capacity (kW)</span>
                                <div className="legend-row">
                                    <span><i className="legend-box blue" /> Installed Capacity</span>
                                    <span><i className="legend-box purple" /> Capacity Factor</span>
                                </div>
                            </div>

                            <div className="tech-chart">
                                <div className="y-axis">
                                    <span>120 kW</span>
                                    <span>100 kW</span>
                                    <span>80 kW</span>
                                    <span>60 kW</span>
                                    <span>40 kW</span>
                                    <span>20 kW</span>
                                    <span>0</span>
                                </div>

                                <div className="bars-area">
                                    {technology.map((item) => (
                                        <div className="bar-group" key={item.name}>
                                            <div className="bar-wrap-2">
                                                <div
                                                    className="capacity-bar"
                                                    style={{
                                                        height: `${(item.capacity / 120) * 100}%`,
                                                        background: item.color,
                                                    }}
                                                >
                                                    {item.capacity > 0 && <span>{item.capacity} kW</span>}
                                                </div>

                                                <div
                                                    className="factor-pill"
                                                    style={{ bottom: `${item.factor}%` }}
                                                >
                                                    {item.factor}%
                                                </div>
                                            </div>
                                            <p>{item.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>

                        <article className="panel cost-panel">
                            <div className="panel-head">
                                <h3>Cost Distribution</h3>
                                <span className="info-dot">i</span>
                            </div>

                            <div className="donut" style={donutStyle}>
                                <div className="donut-center">
                                    <strong>14.292 €</strong>
                                    <span>30 days</span>
                                </div>
                            </div>

                            <div className="cost-legend">
                                {costSegments.map((item) => (
                                    <div className="cost-item" key={item.label}>
                                        <span className="cost-label">
                                            <i style={{ background: item.color }} />
                                            {item.label}
                                        </span>
                                        <strong>{item.value}%</strong>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </div>

                    <div className="lower-grid secondary">
                        <article className="panel">
                            <div className="panel-head">
                                <h3>Asset Summary</h3>
                            </div>

                            <div className="asset-grid">
                                {assetStats.map((item) => (
                                    <div className="asset-box" key={item.label}>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                ))}
                            </div>
                        </article>

                        <article className="panel">
                            <div className="panel-head">
                                <h3>Recent Events</h3>
                            </div>

                            <ul className="event-list">
                                {events.map((event) => (
                                    <li key={event.text}>
                                        <span className={`event-dot ${event.tone}`} />
                                        {event.text}
                                    </li>
                                ))}
                            </ul>
                        </article>
                    </div>
                </div>
            </section>
        </main>
    );
}

export default App;
