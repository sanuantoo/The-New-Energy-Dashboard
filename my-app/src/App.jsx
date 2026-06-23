import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { useRef, useState } from "react";
import "./App.css";
import OpenLayersMap from "./components/OpenLayersMap";
import {
    BASE_COST_EUR,
    BASE_DEMAND_MWH,
    defaultResources,
    formatCurrency,
    formatEnergy,
    formatEnergyKwh,
    formatPercent,
    formatPowerKw,
    getDashboardKpis,
    getDashboardSnapshot,
    numberFormatter,
    resourceTypeConfig,
} from "./dashboardMetrics";

const FLOW_DIAGRAM_HEIGHT = 680;
const FLOW_GRID_SOURCE_Y_RATIO = 92 / 820;
const FLOW_RENEWABLE_SOURCE_START_RATIO = 230 / 820;
const FLOW_RENEWABLE_SOURCE_STEP_RATIO = 92 / 820;
const FLOW_HUB_CENTER_Y_RATIO = 390 / 820;
const FLOW_HUB_TO_COMMERCIAL_Y_RATIO = 372 / 820;
const FLOW_HUB_TO_RESIDENTIAL_Y_RATIO = 410 / 820;
const FLOW_COMMERCIAL_TARGET_Y_RATIO = 182 / 820;
const FLOW_RESIDENTIAL_TARGET_Y_RATIO = 612 / 820;
const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const CHART_PADDING = 22;
const LOAD_PROFILE_MAX_KW = 100;

function getChartPoints(values, width, height, padding, maxValue) {
    if (values.length === 0) {
        return [];
    }

    const safeMax = maxValue > 0 ? maxValue : Number.EPSILON;
    const step = values.length > 1 ? (width - (padding * 2)) / (values.length - 1) : 0;

    return values.map((value, index) => {
        const x = padding + (step * index);
        const y = height - padding - ((value / safeMax) * (height - (padding * 2)));
        return { x, y };
    });
}

function buildLinePath(values, width, height, padding, maxValue) {
    const points = getChartPoints(values, width, height, padding, maxValue);

    if (points.length === 0) {
        return "";
    }

    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(values, width, height, padding, maxValue) {
    const points = getChartPoints(values, width, height, padding, maxValue);

    if (points.length === 0) {
        return "";
    }

    const baselineY = height - padding;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const lineSection = points.map((point) => `L ${point.x} ${point.y}`).join(" ");

    return `M ${firstPoint.x} ${baselineY} ${lineSection} L ${lastPoint.x} ${baselineY} Z`;
}

function getCenteredChartPoints(values, width, height, padding, maxAbsValue) {
    if (values.length === 0) {
        return [];
    }

    const safeMax = Math.max(maxAbsValue, 1);
    const step = values.length > 1 ? (width - (padding * 2)) / (values.length - 1) : 0;
    const centerY = height / 2;
    const usableHalfHeight = (height - (padding * 2)) / 2;

    return values.map((value, index) => ({
        x: padding + (step * index),
        y: centerY - ((value / safeMax) * usableHalfHeight),
    }));
}

function buildCenteredLinePath(values, width, height, padding, maxAbsValue) {
    const points = getCenteredChartPoints(values, width, height, padding, maxAbsValue);

    if (points.length === 0) {
        return "";
    }

    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function App() {
    const mapRef = useRef(null);
    const diagramExportRef = useRef(null);
    const [showMap, setShowMap] = useState(false);
    const [exportingFormat, setExportingFormat] = useState("");

    const resources = defaultResources;
    const {
        amortizedCapex,
        avoidedGridCost,
        commercialDemand,
        commercialDemandShare,
        gridImport,
        renewableGeneration,
        renewableShare,
        residentialDemand,
        residentialDemandShare,
        totalCost,
    } = getDashboardSnapshot(resources);

    const kpis = getDashboardKpis(resources);

    const resourceMix = Object.keys(resourceTypeConfig)
        .map((type) => {
            const count = resources.filter((resource) => resource.type === type).length;
            return count > 0 ? `${resourceTypeConfig[type].label} ${count}` : null;
        })
        .filter(Boolean)
        .join(" • ");

    const typeBreakdown = Object.keys(resourceTypeConfig)
        .map((type) => {
            const matchingResources = resources.filter((resource) => resource.type === type);
            const totalOutput = matchingResources.reduce((total, resource) => total + resource.annualOutputMWh, 0);

            if (matchingResources.length === 0) {
                return null;
            }

            return {
                type,
                label: resourceTypeConfig[type].label,
                icon: resourceTypeConfig[type].icon,
                count: matchingResources.length,
                output: totalOutput,
                value: formatEnergy(totalOutput),
                resources: matchingResources,
            };
        })
        .filter(Boolean);

    const pvResources = resources.filter((resource) => resource.type === "pv");
    const windResources = resources.filter((resource) => resource.type === "wind");
    const batteryResources = resources.filter((resource) => resource.type === "battery");
    const biomassResources = resources.filter((resource) => resource.type === "biomass");
    const geothermalResources = resources.filter((resource) => resource.type === "geothermal");
    const hydropowerResources = resources.filter((resource) => resource.type === "hydropower");

    const pvGeneration = typeBreakdown.find((item) => item.type === "pv")?.output ?? 0;
    const windGeneration = typeBreakdown.find((item) => item.type === "wind")?.output ?? 0;
    const batteryGeneration = typeBreakdown.find((item) => item.type === "battery")?.output ?? 0;
    const biomassGeneration = typeBreakdown.find((item) => item.type === "biomass")?.output ?? 0;
    const geothermalGeneration = typeBreakdown.find((item) => item.type === "geothermal")?.output ?? 0;
    const hydropowerGeneration = typeBreakdown.find((item) => item.type === "hydropower")?.output ?? 0;
    const otherRenewableGeneration = Math.max(renewableGeneration - pvGeneration - windGeneration, 0);
    const inverterThroughput = pvGeneration + windGeneration + hydropowerGeneration;
    const gridInterfaceLoad = gridImport;
    const thermalLoopOutput = geothermalGeneration + biomassGeneration;

    const renewableSourceTones = {
        pv: "solar",
        wind: "wind",
        battery: "battery",
        biomass: "biomass",
        geothermal: "geothermal",
        hydropower: "hydropower",
    };

    const dailyDemandWeights = [0.93, 0.99, 1.04, 0.97, 1.08, 1.05, 0.94];
    const dailyRenewableWeights = [0.86, 0.98, 1.12, 0.95, 1.08, 1.14, 0.87];
    const monthlyLabels = Array.from({ length: 30 }, (_, index) => `D${index + 1}`);
    const monthlyDemandWeights = monthlyLabels.map((_, index) => dailyDemandWeights[index % dailyDemandWeights.length]);
    const monthlyRenewableWeights = monthlyLabels.map((_, index) => dailyRenewableWeights[index % dailyRenewableWeights.length]);
    const totalMonthlyDemandWeight = monthlyDemandWeights.reduce((total, value) => total + value, 0);
    const totalMonthlyRenewableWeight = monthlyRenewableWeights.reduce((total, value) => total + value, 0);

    const renewableSourceShares = {
        pv: renewableGeneration > 0 ? pvGeneration / renewableGeneration : 0,
        wind: renewableGeneration > 0 ? windGeneration / renewableGeneration : 0,
        battery: renewableGeneration > 0 ? batteryGeneration / renewableGeneration : 0,
        biomass: renewableGeneration > 0 ? biomassGeneration / renewableGeneration : 0,
        geothermal: renewableGeneration > 0 ? geothermalGeneration / renewableGeneration : 0,
        hydropower: renewableGeneration > 0 ? hydropowerGeneration / renewableGeneration : 0,
    };

    const monthlyEnergyBalance = monthlyLabels.map((label, index) => {
        const demand = BASE_DEMAND_MWH * (monthlyDemandWeights[index] / totalMonthlyDemandWeight);
        const renewable = Math.min(demand, renewableGeneration * (monthlyRenewableWeights[index] / totalMonthlyRenewableWeight));
        const grid = Math.max(demand - renewable, 0);

        return {
            label,
            demand,
            renewable,
            grid,
            pv: renewable * renewableSourceShares.pv,
            wind: renewable * renewableSourceShares.wind,
            battery: renewable * renewableSourceShares.battery,
            biomass: renewable * renewableSourceShares.biomass,
            geothermal: renewable * renewableSourceShares.geothermal,
            hydropower: renewable * renewableSourceShares.hydropower,
        };
    });

    const monthlySupplyDemand = monthlyEnergyBalance.map(({ label, demand, renewable, grid }) => ({
        label,
        demand,
        renewable,
        grid,
    }));

    const hourlyLabels = ["00", "04", "08", "12", "16", "20"];
    const hourlyLoadKw = [45, 43, 41, 39, 39.5, 45, 54, 63, 73, 78, 81, 84, 83, 80, 76, 76.5, 81, 87, 88, 83, 74, 66, 60, 52];
    const dailyLoadProfile = hourlyLoadKw.map((loadKw, index) => ({
        hour: index,
        load: loadKw / 1000,
    }));

    const technologyCapacity = Object.keys(resourceTypeConfig).map((type) => ({
        key: type,
        label: resourceTypeConfig[type].label,
        tone: renewableSourceTones[type] || "solar",
        value: resources
            .filter((resource) => resource.type === type)
            .reduce((total, resource) => total + (resource.capacityKw || 0), 0),
    }));
    const costContribution = [
        { key: "base", label: "Base operations", value: BASE_COST_EUR, tone: "base" },
        { key: "capex", label: "Renewable capex", value: amortizedCapex, tone: "capex" },
        { key: "savings", label: "Grid cost avoided", value: avoidedGridCost, tone: "savings" },
    ];

    const monthlyBalanceChart = monthlyEnergyBalance.map((item, index) => ({
        ...item,
        displayLabel: `12/${String(index + 1).padStart(2, "0")}`,
        consumption: item.demand,
        renewableUse: item.renewable,
        gridImport: item.grid,
    }));
    const activeBalanceLegend = [
        { key: "grid", label: "Grid Import", tone: "grid" },
        { key: "consumption", label: "Consumption", tone: "consumption" },
        { key: "renewable-line", label: "Renewable Use Line", tone: "renewable-line" },
    ];
    const loadProfileSeries = dailyLoadProfile.map((item) => item.load);
    const monthlySupplyDemandMax = Math.max(...monthlySupplyDemand.map((item) => item.demand), 1);
    const loadProfileMax = LOAD_PROFILE_MAX_KW / 1000;
    const balanceMax = Math.max(...monthlyBalanceChart.map((item) => item.demand), 1);
    const balanceAxisMax = Math.max(balanceMax, 1);
    const balanceAxisTicks = [balanceAxisMax, balanceAxisMax / 2, 0, -balanceAxisMax / 2, -balanceAxisMax];
    const balanceLineSeries = monthlyBalanceChart.map((item) => item.renewableUse);
    const balanceLinePath = buildCenteredLinePath(balanceLineSeries, 100, 100, 2, balanceAxisMax);
    const balanceLinePoints = getCenteredChartPoints(balanceLineSeries, 100, 100, 2, balanceAxisMax);
    const capacityMax = Math.max(...technologyCapacity.map((item) => item.value), 1);
    const costContributionMax = Math.max(...costContribution.map((item) => item.value), 1);
    const loadProfilePath = buildLinePath(loadProfileSeries, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING, loadProfileMax);
    const loadProfileAreaPath = buildAreaPath(loadProfileSeries, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING, loadProfileMax);
    const loadProfilePoints = getChartPoints(loadProfileSeries, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING, loadProfileMax);
    const averageLoad = loadProfileSeries.reduce((total, value) => total + value, 0) / loadProfileSeries.length;
    const averageLoadY = CHART_HEIGHT - CHART_PADDING - ((averageLoad / loadProfileMax) * (CHART_HEIGHT - (CHART_PADDING * 2)));
    const loadYAxisTicks = [0, 20, 40, 60, 80, 100].map((tickKw) => tickKw / 1000);
    const morningPeakWindow = { start: 10, end: 13, label: "Morning Peak" };
    const eveningPeakWindow = { start: 16, end: 20, label: "Evening Peak" };
    const xStep = (CHART_WIDTH - (CHART_PADDING * 2)) / Math.max(loadProfileSeries.length - 1, 1);
    const peakWindows = [morningPeakWindow, eveningPeakWindow].map((window) => ({
        ...window,
        x: CHART_PADDING + (window.start * xStep),
        width: Math.max((window.end - window.start) * xStep, xStep * 1.6),
    }));
    const peakPointIndexes = new Set([
        ...Array.from({ length: morningPeakWindow.end - morningPeakWindow.start + 1 }, (_, index) => morningPeakWindow.start + index),
        ...Array.from({ length: eveningPeakWindow.end - eveningPeakWindow.start + 1 }, (_, index) => eveningPeakWindow.start + index),
    ]);

    const flowGridSourceY = FLOW_DIAGRAM_HEIGHT * FLOW_GRID_SOURCE_Y_RATIO;
    const flowRenewableSourceStartY = FLOW_DIAGRAM_HEIGHT * FLOW_RENEWABLE_SOURCE_START_RATIO;
    const flowRenewableSourceStepY = FLOW_DIAGRAM_HEIGHT * FLOW_RENEWABLE_SOURCE_STEP_RATIO;
    const flowHubCenterY = FLOW_DIAGRAM_HEIGHT * FLOW_HUB_CENTER_Y_RATIO;
    const flowHubToCommercialY = FLOW_DIAGRAM_HEIGHT * FLOW_HUB_TO_COMMERCIAL_Y_RATIO;
    const flowHubToResidentialY = FLOW_DIAGRAM_HEIGHT * FLOW_HUB_TO_RESIDENTIAL_Y_RATIO;
    const flowCommercialTargetY = FLOW_DIAGRAM_HEIGHT * FLOW_COMMERCIAL_TARGET_Y_RATIO;
    const flowResidentialTargetY = FLOW_DIAGRAM_HEIGHT * FLOW_RESIDENTIAL_TARGET_Y_RATIO;

    const renewableSourceNodes = typeBreakdown.map((item, index) => {
        const share = BASE_DEMAND_MWH > 0 ? (item.output / BASE_DEMAND_MWH) * 100 : 0;

        return {
            key: item.type,
            title: item.label,
            icon: item.icon,
            value: item.value,
            percent: formatPercent(share),
            note: `${numberFormatter.format(share)}% of demand`,
            tone: renewableSourceTones[item.type] || "solar",
            tooltip: item.resources.map((resource) => `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`),
            y: flowRenewableSourceStartY + (index * flowRenewableSourceStepY),
        };
    });

    const sourceNodes = [
        {
            key: "grid",
            title: "Grid Import",
            icon: "⚡",
            value: formatEnergy(gridImport),
            percent: formatPercent(100 - renewableShare),
            note: `${numberFormatter.format(Math.max(100 - renewableShare, 0))}% of demand`,
            tone: "grid",
            tooltip: [
                `Grid import • ${formatEnergy(gridImport)}`,
                `Demand share • ${formatPercent(100 - renewableShare)}`,
                "Imported from the external electricity network.",
            ],
            y: flowGridSourceY,
        },
        ...renewableSourceNodes,
    ];

    const sourceLinkCoords = sourceNodes.map((node) => ({
        key: `${node.key}-to-hub`,
        className: `${node.tone}-to-hub`,
        amount: node.value,
        percent: node.percent,
        badgeLeft: 28,
        badgeTop: `${((node.y / FLOW_DIAGRAM_HEIGHT) * 100) - 2}%`,
    }));

    const legendItems = [
        { key: "grid", label: "Grid Import", tone: "grid" },
        ...typeBreakdown.map((item) => ({
            key: item.type,
            label: item.label,
            tone: renewableSourceTones[item.type] || "solar",
        })),
        { key: "hub", label: "Energy System", tone: "hub" },
        { key: "commercial", label: "Commercial Demand", tone: "commercial" },
        { key: "residential", label: "Residential Demand", tone: "residential" },
    ];

    const systemSubnodes = [
        {
            key: "storage",
            label: "Storage",
            value: formatEnergy(batteryGeneration),
            note: batteryResources.length > 0 ? `${batteryResources.length} battery assets` : "No battery assets configured",
            tooltip: batteryResources.length > 0
                ? batteryResources.map((resource) => `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`)
                : ["Battery dispatch will appear here when a battery resource is added."],
        },
        {
            key: "inverter",
            label: "Inverter",
            value: formatEnergy(inverterThroughput),
            note: "PV, wind, and hydropower conversion path",
            tooltip: [
                `PV throughput • ${formatEnergy(pvGeneration)}`,
                `Wind throughput • ${formatEnergy(windGeneration)}`,
                `Hydropower throughput • ${formatEnergy(hydropowerGeneration)}`,
            ],
        },
        {
            key: "interface",
            label: "Grid Interface",
            value: formatEnergy(gridInterfaceLoad),
            note: "External import handoff",
            tooltip: [
                `Current import • ${formatEnergy(gridImport)}`,
                `Grid share • ${formatPercent(100 - renewableShare)}`,
            ],
        },
        {
            key: "thermal",
            label: "Geothermal / Biomass",
            value: formatEnergy(thermalLoopOutput),
            note: geothermalResources.length + biomassResources.length > 0
                ? `${geothermalResources.length + biomassResources.length} thermal renewable assets`
                : "No geothermal or biomass assets configured",
            tooltip: [
                `Geothermal output • ${formatEnergy(geothermalGeneration)}`,
                `Biomass output • ${formatEnergy(biomassGeneration)}`,
            ],
        },
        {
            key: "water",
            label: "Hydropower",
            value: formatEnergy(hydropowerGeneration),
            note: hydropowerResources.length > 0 ? `${hydropowerResources.length} hydropower assets` : "No hydropower assets configured",
            tooltip: hydropowerResources.length > 0
                ? hydropowerResources.map((resource) => `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`)
                : ["Hydropower contribution appears here when hydropower assets are added."],
        },
    ];

    const demandNodes = [
        {
            key: "commercial",
            title: "Commercial Demand",
            icon: "🏢",
            value: formatEnergy(commercialDemand),
            percent: formatPercent(commercialDemandShare),
            note: `${numberFormatter.format(commercialDemandShare)}% of total demand`,
            tone: "commercial",
            position: "demand-commercial",
            tooltip: [
                `Commercial share • ${formatPercent(commercialDemandShare)}`,
                `Served load • ${formatEnergy(commercialDemand)}`,
                "Commercial demand remains the larger demand sink in this overview.",
            ],
        },
        {
            key: "residential",
            title: "Multi Family House Demand",
            icon: "🏠",
            value: formatEnergy(residentialDemand),
            percent: formatPercent(residentialDemandShare),
            note: `${numberFormatter.format(residentialDemandShare)}% of total demand`,
            tone: "residential",
            position: "demand-residential",
            tooltip: [
                `Residential share • ${formatPercent(residentialDemandShare)}`,
                `Served load • ${formatEnergy(residentialDemand)}`,
                "Residential demand is the remaining share after commercial load.",
            ],
        },
    ];

    const flowLinks = [
        ...sourceLinkCoords,
        {
            key: "hub-to-commercial",
            className: "hub-to-commercial",
            amount: formatEnergy(commercialDemand),
            percent: formatPercent(commercialDemandShare),
            badgeRight: 21,
            badgeTop: "18%",
        },
        {
            key: "hub-to-residential",
            className: "hub-to-residential",
            amount: formatEnergy(residentialDemand),
            percent: formatPercent(residentialDemandShare),
            badgeRight: 20,
            badgeTop: "64%",
        },
    ];

    async function handleExport(format) {
        if (!diagramExportRef.current || exportingFormat) {
            return;
        }

        try {
            setExportingFormat(format);
            const dataUrl = await toPng(diagramExportRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: "#ffffff",
            });

            if (format === "png") {
                const link = document.createElement("a");
                link.download = "energy-flow-diagram.png";
                link.href = dataUrl;
                link.click();
                return;
            }

            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "px",
                format: [1240, 860],
            });
            pdf.addImage(dataUrl, "PNG", 20, 20, 1200, 820);
            pdf.save("energy-flow-diagram.pdf");
        } catch (error) {
            console.error("Failed to export diagram", error);
        } finally {
            setExportingFormat("");
        }
    }

    return (
        <main className="energy-home">
            <header className="dashboard-header brand-header">
                <div className="brand-mark" aria-label="EnerPlanET">
                    <span className="brand-mark-main">EnerPlan</span>
                    <span className="brand-mark-accent">ET</span>
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
                <div className="control-board">
                    <div className="flow-column">
                        <article className="panel pipeline-panel">
                            <div className="panel-head energy-flow-head">
                                <div>
                                    <h3>Energy Flow Diagram</h3>
                                    <p>Flow with amounts and percentages across sources, the energy system, and connected loads.</p>
                                </div>
                                <div className="flow-head-actions">
                                    <span className="flow-period">30 days</span>
                                    <button
                                        className="secondary-btn"
                                        type="button"
                                        disabled={exportingFormat !== ""}
                                        onClick={() => handleExport("png")}
                                    >
                                        {exportingFormat === "png" ? "Exporting PNG..." : "Export PNG"}
                                    </button>
                                    <button
                                        className="secondary-btn"
                                        type="button"
                                        disabled={exportingFormat !== ""}
                                        onClick={() => handleExport("pdf")}
                                    >
                                        {exportingFormat === "pdf" ? "Exporting PDF..." : "Export PDF"}
                                    </button>
                                </div>
                            </div>

                            <div className="diagram-export-surface" ref={diagramExportRef}>
                                <div className="node-link-board" aria-label="energy flow diagram">
                                    <svg className="flow-network-lines" viewBox={`0 0 1000 ${FLOW_DIAGRAM_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                                        {sourceNodes.map((node) => (
                                            <line
                                                className={`flow-line-svg ${node.tone}`}
                                                key={`${node.key}-line`}
                                                x1="180"
                                                y1={node.y}
                                                x2="430"
                                                y2={flowHubCenterY}
                                            />
                                        ))}
                                        <line className="flow-line-svg commercial" x1="570" y1={flowHubToCommercialY} x2="830" y2={flowCommercialTargetY} />
                                        <line className="flow-line-svg residential" x1="570" y1={flowHubToResidentialY} x2="830" y2={flowResidentialTargetY} />
                                    </svg>

                                    {sourceNodes.map((node) => (
                                        <article className={`flow-node-card flow-source-node ${node.tone}`} key={node.key} style={{ left: "2.5%", top: `${(node.y / FLOW_DIAGRAM_HEIGHT) * 100}%` }}>
                                            <div className="flow-node-icon">{node.icon}</div>
                                            <div className="flow-node-copy">
                                                <span className="flow-label">{node.title}</span>
                                                <strong>{node.value}</strong>
                                                <small>{node.percent} · {node.note}</small>
                                            </div>
                                            <div className="flow-tooltip" role="tooltip">
                                                <strong>{node.title}</strong>
                                                <div className="flow-tooltip-lines">
                                                    {node.tooltip.map((line) => (
                                                        <span key={line}>{line}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </article>
                                    ))}

                                    <article className="flow-node-card hub hub-center">
                                        <div className="flow-node-icon">⚙</div>
                                        <div className="flow-node-copy">
                                            <span className="flow-label">Energy System</span>
                                            <strong>{formatEnergy(BASE_DEMAND_MWH)}</strong>
                                            <small>{numberFormatter.format(100)}% system balancing target</small>
                                        </div>
                                        <div className="hub-subnodes">
                                            {systemSubnodes.map((node) => (
                                                <div className="hub-subnode" key={node.key}>
                                                    <span>{node.label}</span>
                                                    <strong>{node.value}</strong>
                                                    <small>{node.note}</small>
                                                </div>
                                            ))}
                                        </div>
                                    </article>

                                    {demandNodes.map((node) => (
                                        <article className={`flow-node-card ${node.tone} ${node.position}`} key={node.key}>
                                            <div className="flow-node-icon">{node.icon}</div>
                                            <div className="flow-node-copy">
                                                <span className="flow-label">{node.title}</span>
                                                <strong>{node.value}</strong>
                                                <small>{node.percent} · {node.note}</small>
                                            </div>
                                            <div className="flow-tooltip" role="tooltip">
                                                <strong>{node.title}</strong>
                                                <div className="flow-tooltip-lines">
                                                    {node.tooltip.map((line) => (
                                                        <span key={line}>{line}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </article>
                                    ))}

                                    {flowLinks.map((link) => (
                                        <div
                                            className={`flow-link-path ${link.className}`}
                                            key={link.key}
                                            aria-hidden="true"
                                            style={link.badgeRight !== undefined ? { right: `${link.badgeRight}%`, top: link.badgeTop } : { left: `${link.badgeLeft}%`, top: link.badgeTop }}
                                        >
                                            <div className="flow-link-badge">
                                                <strong>{link.amount}</strong>
                                                <span>{link.percent}</span>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="flow-legend" aria-label="diagram legend">
                                        {legendItems.map((item) => (
                                            <div className="flow-legend-item" key={item.key}>
                                                <span className={`flow-legend-swatch ${item.tone}`} />
                                                <span>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>

                    <aside className="analytics-rail" aria-label="energy analytics">
                        <article className="panel analytics-card analytics-card-large">
                            <div className="panel-head analytics-head">
                                <div>
                                    <h3>Supply vs Demand</h3>
                                    <p>30-day demand view showing how renewable supply and grid import combine to meet daily demand.</p>
                                </div>
                            </div>

                            <div className="chart-shell supply-demand-shell">
                                <div className="supply-demand-bars" role="img" aria-label="30 day supply versus demand chart">
                                    {monthlySupplyDemand.map((item, index) => (
                                        <div className="supply-demand-column" key={item.label} tabIndex={0}>
                                            <div className="supply-demand-bar-wrap">
                                                <span
                                                    className="supply-demand-demand-line"
                                                    style={{ bottom: `${(item.demand / monthlySupplyDemandMax) * 100}%` }}
                                                />
                                                <div className="supply-demand-bar">
                                                    <span
                                                        className="supply-demand-segment renewable"
                                                        style={{ height: `${(item.renewable / monthlySupplyDemandMax) * 100}%` }}
                                                    />
                                                    <span
                                                        className="supply-demand-segment grid"
                                                        style={{ height: `${(item.grid / monthlySupplyDemandMax) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="chart-hover-card supply-demand-tooltip">
                                                    <strong>Day {index + 1}</strong>
                                                    <span>Demand: {formatEnergyKwh(item.demand)}</span>
                                                    <span>Renewables: {formatEnergyKwh(item.renewable)}</span>
                                                    <span>Grid import: {formatEnergyKwh(item.grid)}</span>
                                                </div>
                                            </div>
                                            <span className="supply-demand-label">{index + 1}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="chart-legend compact">
                                    <span><i className="legend-dot demand-line" /> Total demand</span>
                                    <span><i className="legend-dot supply-line" /> Renewable supply</span>
                                    <span><i className="legend-dot grid" /> Grid import</span>
                                </div>

                                <div className="chart-summary-grid">
                                    <div>
                                        <span>Peak demand day</span>
                                        <strong>{monthlySupplyDemand.reduce((peak, item) => (item.demand > peak.demand ? item : peak), monthlySupplyDemand[0]).label}</strong>
                                    </div>
                                    <div>
                                        <span>30 day renewable share</span>
                                        <strong>{formatPercent(renewableShare)}</strong>
                                    </div>
                                </div>
                            </div>
                        </article>

                        <article className="panel analytics-card analytics-card-medium">
                            <div className="panel-head analytics-head">
                                <div>
                                    <h3>Daily Energy Balance</h3>
                                    <p>Monthly balance view with grid import above zero, consumption below zero, and a renewable-use line.</p>
                                </div>
                            </div>

                            <div className="balance-chart-shell">
                                <div className="balance-y-axis" aria-hidden="true">
                                    <span>{formatEnergyKwh(balanceAxisTicks[0])}</span>
                                    <span>{formatEnergyKwh(balanceAxisTicks[1])}</span>
                                    <span>0 kWh</span>
                                    <span>-{formatEnergyKwh(Math.abs(balanceAxisTicks[3])).replace(" kWh", "")}</span>
                                    <span>-{formatEnergyKwh(Math.abs(balanceAxisTicks[4])).replace(" kWh", "")}</span>
                                </div>

                                <div className="balance-chart-stage">
                                    <div className="balance-axis-head">
                                        <div className="balance-y-axis-title">Energy (kWh)</div>
                                        <div className="balance-y-axis-title balance-y-axis-title-right">Renewables (kWh)</div>
                                    </div>
                                    <div className="balance-chart-frame">
                                        <div className="balance-grid-lines" aria-hidden="true">
                                            {[0, 1, 2, 3, 4].map((line) => (
                                                <span key={line} className="balance-grid-line" />
                                            ))}
                                        </div>
                                        <span className="balance-zero-line" aria-hidden="true" />
                                        <svg className="balance-net-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                                            <path className="balance-net-line" d={balanceLinePath} />
                                            {balanceLinePoints.map((point, index) => (
                                                <circle className="balance-net-point" key={monthlyBalanceChart[index].label} cx={point.x} cy={point.y} r="0.75" />
                                            ))}
                                        </svg>
                                        <div className="balance-chart" role="img" aria-label="Daily energy balance by day of month">
                                            {monthlyBalanceChart.map((item) => (
                                                <div className="balance-column" key={item.label} tabIndex={0}>
                                                    <div className="balance-stack-wrap">
                                                        <div className="balance-positive-zone">
                                                            <div className="balance-positive-stack">
                                                                <span
                                                                    className="balance-segment grid"
                                                                    style={{ height: `${(item.gridImport / balanceAxisMax) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="balance-negative-zone">
                                                            <span
                                                                className="balance-consumption-bar"
                                                                style={{ height: `${(item.consumption / balanceAxisMax) * 100}%` }}
                                                            />
                                                        </div>
                                                        <div className="chart-hover-card balance-tooltip">
                                                            <strong>{item.displayLabel}</strong>
                                                            <span>Consumption: {formatEnergyKwh(item.consumption)}</span>
                                                            <span>Renewable use: {formatEnergyKwh(item.renewableUse)}</span>
                                                            <span>Grid import: {formatEnergyKwh(item.gridImport)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="balance-axis-labels" aria-hidden="true">
                                        {monthlyBalanceChart.map((item, index) => (
                                            <span key={item.label}>{index % 3 === 0 || index === monthlyBalanceChart.length - 1 ? item.displayLabel : ""}</span>
                                        ))}
                                    </div>
                                    <div className="balance-x-axis-title">Days of month</div>
                                </div>
                            </div>

                            <div className="chart-legend balance-legend">
                                {activeBalanceLegend.map((item) => (
                                    <span key={item.key}><i className={`legend-dot ${item.tone}`} /> {item.label}</span>
                                ))}
                            </div>
                        </article>

                    </aside>
                </div>

                <div className="analytics-mini-grid analytics-mini-grid-wide analytics-mini-grid-triple">
                    <article className="panel analytics-card analytics-card-small">
                        <div className="panel-head analytics-head">
                            <div>
                                <h3>Daily Load Profile</h3>
                                <p>Average day power profile with peak periods, average band, and point hover details.</p>
                            </div>
                        </div>

                        <div className="chart-shell mini-shell load-profile-shell">
                            <div className="load-profile-layout">
                                <div className="load-profile-y-axis" aria-hidden="true">
                                    {loadYAxisTicks.slice().reverse().map((tick) => (
                                        <span key={tick}>{formatPowerKw(tick)}</span>
                                    ))}
                                </div>

                                <div className="load-profile-stage">
                                    <svg className="line-chart load-profile-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Daily load profile chart">
                                        {loadYAxisTicks.slice(1).map((tick) => {
                                            const y = CHART_HEIGHT - CHART_PADDING - ((tick / loadProfileMax) * (CHART_HEIGHT - (CHART_PADDING * 2)));
                                            return (
                                                <line
                                                    className="chart-grid-line"
                                                    key={tick}
                                                    x1={CHART_PADDING}
                                                    x2={CHART_WIDTH - CHART_PADDING}
                                                    y1={y}
                                                    y2={y}
                                                />
                                            );
                                        })}
                                        {peakWindows.map((window) => (
                                            <g key={window.label}>
                                                <rect
                                                    className="load-peak-band"
                                                    x={window.x}
                                                    y={CHART_PADDING}
                                                    width={window.width}
                                                    height={CHART_HEIGHT - (CHART_PADDING * 2)}
                                                />
                                                <text className="load-peak-label" x={window.x + (window.width / 2)} y={CHART_PADDING - 6}>
                                                    {window.label}
                                                </text>
                                            </g>
                                        ))}
                                        <path className="chart-area load-area" d={loadProfileAreaPath} />
                                        <line className="load-average-line" x1={CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y1={averageLoadY} y2={averageLoadY} />
                                        <text className="load-average-label" x={CHART_WIDTH - CHART_PADDING + 10} y={averageLoadY + 4}>Avg</text>
                                        <path className="chart-line load-line" d={loadProfilePath} />
                                        {loadProfilePoints.map((point, index) => (
                                            <g className="load-point-group" key={dailyLoadProfile[index].hour}>
                                                {(() => {
                                                    const tooltipWidth = 92;
                                                    const tooltipCenterX = Math.min(
                                                        CHART_WIDTH - (tooltipWidth / 2) - 4,
                                                        Math.max((tooltipWidth / 2) + 4, point.x),
                                                    );

                                                    return (
                                                        <>
                                                            <circle
                                                                className={`load-point ${peakPointIndexes.has(index) ? "peak" : "base"}`}
                                                                cx={point.x}
                                                                cy={point.y}
                                                                r="3.2"
                                                            />
                                                            <g className="load-point-tooltip">
                                                                <rect x={tooltipCenterX - (tooltipWidth / 2)} y={point.y - 46} rx="9" ry="9" width={tooltipWidth} height="32" />
                                                                <text x={tooltipCenterX} y={point.y - 30}>{`${String(dailyLoadProfile[index].hour).padStart(2, "0")}:00`}</text>
                                                                <text x={tooltipCenterX} y={point.y - 18}>{formatPowerKw(dailyLoadProfile[index].load)}</text>
                                                            </g>
                                                        </>
                                                    );
                                                })()}
                                            </g>
                                        ))}
                                    </svg>

                                    <div className="load-profile-x-axis" aria-hidden="true">
                                        {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                                            <span key={hour}>{`${String(hour).padStart(2, "0")}:00`}</span>
                                        ))}
                                    </div>
                                    <div className="load-profile-x-title">Time of Day</div>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="panel analytics-card analytics-card-small analytics-card-compact">
                        <div className="panel-head analytics-head">
                            <div>
                                <h3>Technology Capacity</h3>
                                <p>Installed capacity by technology.</p>
                            </div>
                        </div>

                        <div className="capacity-list">
                            {technologyCapacity.map((item) => (
                                <div className="capacity-row" key={item.key}>
                                    <div className="capacity-meta">
                                        <span>{item.label}</span>
                                        <strong>{numberFormatter.format(item.value)} kW</strong>
                                    </div>
                                    <div className="capacity-bar-track">
                                        <span className={`capacity-bar ${item.tone}`} style={{ width: `${capacityMax > 0 ? (item.value / capacityMax) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className="panel analytics-card analytics-card-small analytics-card-compact">
                        <div className="panel-head analytics-head">
                            <div>
                                <h3>Cost Contribution</h3>
                                <p>Monthly cost drivers and renewable offset.</p>
                            </div>
                        </div>

                        <div className="cost-list">
                            {costContribution.map((item) => (
                                <div className="cost-row" key={item.key}>
                                    <div className="cost-meta">
                                        <span>{item.label}</span>
                                        <strong>{formatCurrency(item.value)}</strong>
                                    </div>
                                    <div className="cost-bar-track">
                                        <span className={`cost-bar ${item.tone}`} style={{ width: `${costContributionMax > 0 ? (item.value / costContributionMax) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                            <div className="cost-total-row">
                                <span>Net total cost</span>
                                <strong>{formatCurrency(totalCost)}</strong>
                            </div>
                        </div>
                    </article>
                </div>

                <section className="map-section">
                    <div className="map-section-head">
                        <div>
                            <h3>Asset map</h3>
                            <p>Keep the map hidden until you need a spatial view of the system.</p>
                        </div>
                        <button
                            className="secondary-btn map-toggle-btn"
                            type="button"
                            onClick={() => setShowMap((currentValue) => !currentValue)}
                        >
                            {showMap ? "Hide map" : "Show map"}
                        </button>
                    </div>

                    {showMap ? (
                        <article className="panel map-panel">
                            <div className="map-hint">Map view</div>

                            <div className="map-controls">
                                <button type="button" onClick={() => mapRef.current?.zoomIn()}>＋</button>
                                <button type="button" onClick={() => mapRef.current?.zoomOut()}>－</button>
                                <button type="button" onClick={() => mapRef.current?.resetView()}>◎</button>
                            </div>

                            <OpenLayersMap ref={mapRef} />
                        </article>
                    ) : (
                        <div className="map-collapsed-state">
                            The map is hidden by default. Open it when you need to inspect site geography and asset placement.
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}

export default App;
