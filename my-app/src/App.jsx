import { useRef } from "react";
import "./App.css";
import OpenLayersMap from "./components/OpenLayersMap";

const kpis = [
    { icon: "⚡", title: "Total Demand", value: "45.19 MWh", note: "over 30 days" },
    { icon: "⇄", title: "Grid Import", value: "45.19 MWh", note: "over 30 days" },
    { icon: "☼", title: "Renewable Generation", value: "0.0 kWh", note: "over 30 days" },
    { icon: "€", title: "Total Cost", value: "€14.292", note: "Equipment + Running Costs" },
];

const flowNodes = [
    {
        title: "Grid Supply",
        value: "45.19 MWh",
        note: "Imported energy",
        tone: "grid",
        direction: "out",
    },
    {
        title: "Renewables",
        value: "0.0 kWh",
        note: "Solar and storage",
        tone: "renewable",
        direction: "out",
    },
    {
        title: "Buildings",
        value: "8 sites",
        note: "Connected assets",
        tone: "load",
        direction: "in",
    },
    {
        title: "Total Cost",
        value: "€14.292",
        note: "Operational spend",
        tone: "cost",
        direction: "in",
    },
];

function App() {
    const mapRef = useRef(null);

    return (
        <main className="energy-home">
            <header className="dashboard-header">
                <div>
                    <p className="eyebrow">Energy System Monitor</p>
                    <h1>Operational Overview</h1>
                </div>
                <div className="header-note">Four key metrics, map, and energy flow overview</div>
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
                    <div className="map-hint">Map view</div>

                    <div className="map-controls">
                        <button type="button" onClick={() => mapRef.current?.zoomIn()}>＋</button>
                        <button type="button" onClick={() => mapRef.current?.zoomOut()}>－</button>
                        <button type="button" onClick={() => mapRef.current?.resetView()}>◎</button>
                    </div>

                    <OpenLayersMap ref={mapRef} />
                </article>

                <div className="content-stack">
                    <article className="panel energy-flow-panel">
                        <div className="panel-head energy-flow-head">
                            <div>
                                <h3>Energy Flow Diagram</h3>
                                <p>Live relationship between supply, loads, and operating cost.</p>
                            </div>
                            <span className="flow-period">30 days</span>
                        </div>

                        <div className="energy-flow-grid">
                            <div className="flow-column">
                                {flowNodes
                                    .filter((node) => node.direction === "out")
                                    .map((node) => (
                                        <article className={`flow-card ${node.tone}`} key={node.title}>
                                            <span className="flow-label">{node.title}</span>
                                            <strong>{node.value}</strong>
                                            <small>{node.note}</small>
                                        </article>
                                    ))}
                            </div>

                            <div className="flow-core" aria-label="energy flow diagram">
                                <div className="flow-line horizontal left" />
                                <div className="flow-line horizontal right" />
                                <div className="flow-line vertical top" />
                                <div className="flow-line vertical bottom" />
                                <div className="flow-node">
                                    <span>Site Energy Hub</span>
                                    <strong>45.19 MWh</strong>
                                    <small>Balancing demand, imports, and generation</small>
                                </div>
                            </div>

                            <div className="flow-column">
                                {flowNodes
                                    .filter((node) => node.direction === "in")
                                    .map((node) => (
                                        <article className={`flow-card ${node.tone}`} key={node.title}>
                                            <span className="flow-label">{node.title}</span>
                                            <strong>{node.value}</strong>
                                            <small>{node.note}</small>
                                        </article>
                                    ))}
                            </div>
                        </div>

                        <div className="flow-summary">
                            <div>
                                <span>Primary source</span>
                                <strong>Grid import currently covers full demand.</strong>
                            </div>
                            <div>
                                <span>Renewables</span>
                                <strong>No active generation in the selected period.</strong>
                            </div>
                        </div>
                    </article>
                </div>
            </section>
        </main>
    );
}

export default App;
