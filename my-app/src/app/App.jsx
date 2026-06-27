// Import library to convert HTML elements into PNG images.
import { toPng } from "html-to-image";

// Import jsPDF library for generating PDF documents.
import { jsPDF } from "jspdf";

// Import React hooks for references and component state.
import { useRef, useState } from "react";

// Import application styles.
import "./App.css";

// Import the OpenLayers map component.
import OpenLayersMap from "../components/maps/OpenLayersMap";

// Import dashboard data, formatting utilities, and configuration objects.
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
} from "../data/dashboardMetrics";

/* ------------------------------------------------------------------
   Flow Diagram Layout Constants
   These constants define the size and relative positioning of nodes
   and connectors within the energy flow diagram.
------------------------------------------------------------------- */

// Overall height of the flow diagram.
const FLOW_DIAGRAM_HEIGHT = 680;

// Vertical positioning ratios for different energy sources and destinations.
const FLOW_GRID_SOURCE_Y_RATIO = 92 / 820;
const FLOW_RENEWABLE_SOURCE_START_RATIO = 230 / 820;
const FLOW_RENEWABLE_SOURCE_STEP_RATIO = 92 / 820;
const FLOW_HUB_CENTER_Y_RATIO = 390 / 820;
const FLOW_HUB_TO_COMMERCIAL_Y_RATIO = 372 / 820;
const FLOW_HUB_TO_RESIDENTIAL_Y_RATIO = 410 / 820;
const FLOW_COMMERCIAL_TARGET_Y_RATIO = 182 / 820;
const FLOW_RESIDENTIAL_TARGET_Y_RATIO = 612 / 820;

/* ------------------------------------------------------------------
   Chart Layout Constants
   Used for rendering SVG charts consistently across the dashboard.
------------------------------------------------------------------- */

const CHART_WIDTH = 360;
const CHART_HEIGHT = 180;
const CHART_PADDING = 22;
const LOAD_PROFILE_MAX_KW = 100;

/*
 * Converts chart values into SVG coordinate points.
 * Used to plot standard line and area charts.
 */
function getChartPoints(values, width, height, padding, maxValue) {
    if (values.length === 0) {
        return [];
    }

    // Prevent division by zero.
    const safeMax = maxValue > 0 ? maxValue : Number.EPSILON;

    // Calculate horizontal spacing between data points.
    const step =
        values.length > 1
            ? (width - (padding * 2)) / (values.length - 1)
            : 0;

    return values.map((value, index) => {
        const x = padding + (step * index);

        // Convert value into SVG Y coordinate.
        const y =
            height -
            padding -
            ((value / safeMax) * (height - (padding * 2)));

        return { x, y };
    });
}

/*
 * Builds an SVG line path string from chart data.
 */
function buildLinePath(values, width, height, padding, maxValue) {
    const points = getChartPoints(values, width, height, padding, maxValue);

    if (points.length === 0) {
        return "";
    }

    return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
}

/*
 * Builds a closed SVG area path for filled trend charts.
 */
function buildAreaPath(values, width, height, padding, maxValue) {
    const points = getChartPoints(values, width, height, padding, maxValue);

    if (points.length === 0) {
        return "";
    }

    const baselineY = height - padding;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    const lineSection = points
        .map((point) => `L ${point.x} ${point.y}`)
        .join(" ");

    return `M ${firstPoint.x} ${baselineY} ${lineSection} L ${lastPoint.x} ${baselineY} Z`;
}

/*
 * Converts values into coordinates for charts with
 * a centered horizontal axis (positive and negative values).
 */
function getCenteredChartPoints(values, width, height, padding, maxAbsValue) {
    if (values.length === 0) {
        return [];
    }

    // Ensure a minimum scale.
    const safeMax = Math.max(maxAbsValue, 1);

    // Horizontal spacing between points.
    const step =
        values.length > 1
            ? (width - (padding * 2)) / (values.length - 1)
            : 0;

    const centerY = height / 2;
    const usableHalfHeight = (height - (padding * 2)) / 2;

    return values.map((value, index) => ({
        x: padding + (step * index),

        // Position above or below the center line.
        y: centerY - ((value / safeMax) * usableHalfHeight),
    }));
}

/*
 * Generates an SVG path for centered-axis line charts.
 */
function buildCenteredLinePath(values, width, height, padding, maxAbsValue) {
    const points = getCenteredChartPoints(
        values,
        width,
        height,
        padding,
        maxAbsValue
    );

    if (points.length === 0) {
        return "";
    }

    return points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
}

function App() {
    /* -------------------------------------------------------------
       React References
       ------------------------------------------------------------- */

    // Reference to the OpenLayers map instance.
    const mapRef = useRef(null);

    // Reference to the flow diagram used for image/PDF export.
    const diagramExportRef = useRef(null);

    /* -------------------------------------------------------------
       Component State
       ------------------------------------------------------------- */

    // Controls map visibility.
    const [showMap, setShowMap] = useState(false);

    // Tracks the export format currently being generated.
    const [exportingFormat, setExportingFormat] = useState("");

    /* -------------------------------------------------------------
       Dashboard Data
       ------------------------------------------------------------- */

    // Load the predefined energy resources.
    const resources = defaultResources;

    // Calculate key energy metrics from the resource data.
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

    // Generate KPI cards displayed at the top of the dashboard.
    const kpis = getDashboardKpis(resources);

    /* -------------------------------------------------------------
       Resource Summary
       ------------------------------------------------------------- */

    // Generate a short summary describing the installed resource mix.
    const resourceMix = Object.keys(resourceTypeConfig)
        .map((type) => {
            const count = resources.filter(
                (resource) => resource.type === type
            ).length;

            return count > 0
                ? `${resourceTypeConfig[type].label} ${count}`
                : null;
        })
        .filter(Boolean)
        .join(" • ");

    /* -------------------------------------------------------------
       Resource Breakdown
       ------------------------------------------------------------- */

    // Group resources by technology and calculate total generation.
    const typeBreakdown = Object.keys(resourceTypeConfig)
        .map((type) => {
            const matchingResources = resources.filter(
                (resource) => resource.type === type
            );

            const totalOutput = matchingResources.reduce(
                (total, resource) =>
                    total + resource.annualOutputMWh,
                0
            );

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

    /* -------------------------------------------------------------
       Resource Groups
       Separate resources by technology for easier access.
       ------------------------------------------------------------- */

    const pvResources = resources.filter(resource => resource.type === "pv");
    const windResources = resources.filter(resource => resource.type === "wind");
    const batteryResources = resources.filter(resource => resource.type === "battery");
    const biomassResources = resources.filter(resource => resource.type === "biomass");
    const geothermalResources = resources.filter(resource => resource.type === "geothermal");
    const hydropowerResources = resources.filter(resource => resource.type === "hydropower");

    /* -------------------------------------------------------------
       Generation Totals
       Calculate total output for each renewable technology.
       ------------------------------------------------------------- */

    const pvGeneration = typeBreakdown.find(item => item.type === "pv")?.output ?? 0;
    const windGeneration = typeBreakdown.find(item => item.type === "wind")?.output ?? 0;
    const batteryGeneration = typeBreakdown.find(item => item.type === "battery")?.output ?? 0;
    const biomassGeneration = typeBreakdown.find(item => item.type === "biomass")?.output ?? 0;
    const geothermalGeneration = typeBreakdown.find(item => item.type === "geothermal")?.output ?? 0;
    const hydropowerGeneration = typeBreakdown.find(item => item.type === "hydropower")?.output ?? 0;

    // Renewable generation excluding PV and wind.
    const otherRenewableGeneration =
        Math.max(renewableGeneration - pvGeneration - windGeneration, 0);

    // Energy routed through the inverter.
    const inverterThroughput =
        pvGeneration + windGeneration + hydropowerGeneration;

    // Electricity imported from the grid.
    const gridInterfaceLoad = gridImport;

    // Thermal energy supplied by geothermal and biomass.
    const thermalLoopOutput = geothermalGeneration + biomassGeneration;

    /* -------------------------------------------------------------
       Diagram Styling
       Maps each resource type to its visual theme.
       ------------------------------------------------------------- */

    const renewableSourceTones = {
        pv: "solar",
        wind: "wind",
        battery: "battery",
        biomass: "biomass",
        geothermal: "geothermal",
        hydropower: "hydropower",
    };

    /* -------------------------------------------------------------
       Sample data used for demand and renewable generation trends.
       ------------------------------------------------------------- */

    const dailyDemandWeights = [0.93, 0.99, 1.04, 0.97, 1.08, 1.05, 0.94];
    const dailyRenewableWeights = [0.86, 0.98, 1.12, 0.95, 1.08, 1.14, 0.87];

    // Create labels representing 30 days of a month (D1 to D30).
    const monthlyLabels = Array.from({ length: 30 }, (_, index) => `D${index + 1}`);

    // Repeat predefined daily demand weights across the month.
    const monthlyDemandWeights = monthlyLabels.map(
        (_, index) => dailyDemandWeights[index % dailyDemandWeights.length]
    );

    // Repeat renewable generation weights across the month.
    const monthlyRenewableWeights = monthlyLabels.map(
        (_, index) => dailyRenewableWeights[index % dailyRenewableWeights.length]
    );

    // Calculate the total weight values for normalization.
    const totalMonthlyDemandWeight = monthlyDemandWeights.reduce(
        (total, value) => total + value,
        0
    );

    const totalMonthlyRenewableWeight = monthlyRenewableWeights.reduce(
        (total, value) => total + value,
        0
    );

    /* -------------------------------------------------------------
       Renewable Energy Share by Technology
       Determines each technology's contribution to total renewable
       generation for use in charts and energy breakdowns.
       ------------------------------------------------------------- */

    const renewableSourceShares = {
        pv: renewableGeneration > 0 ? pvGeneration / renewableGeneration : 0,
        wind: renewableGeneration > 0 ? windGeneration / renewableGeneration : 0,
        battery: renewableGeneration > 0 ? batteryGeneration / renewableGeneration : 0,
        biomass: renewableGeneration > 0 ? biomassGeneration / renewableGeneration : 0,
        geothermal: renewableGeneration > 0 ? geothermalGeneration / renewableGeneration : 0,
        hydropower: renewableGeneration > 0 ? hydropowerGeneration / renewableGeneration : 0,
    };

    /* -------------------------------------------------------------
       Monthly Energy Balance
       Calculates daily energy demand and divides it into renewable
       supply and grid import while also splitting renewable energy
       among different technologies.
       ------------------------------------------------------------- */

    const monthlyEnergyBalance = monthlyLabels.map((label, index) => {

        // Calculate daily energy demand.
        const demand =
            BASE_DEMAND_MWH *
            (monthlyDemandWeights[index] / totalMonthlyDemandWeight);

        // Renewable energy available for the day.
        const renewable = Math.min(
            demand,
            renewableGeneration *
            (monthlyRenewableWeights[index] /
                totalMonthlyRenewableWeight)
        );

        // Remaining demand supplied by the electrical grid.
        const grid = Math.max(demand - renewable, 0);

        return {
            label,
            demand,
            renewable,
            grid,

            // Renewable contribution by technology.
            pv: renewable * renewableSourceShares.pv,
            wind: renewable * renewableSourceShares.wind,
            battery: renewable * renewableSourceShares.battery,
            biomass: renewable * renewableSourceShares.biomass,
            geothermal: renewable * renewableSourceShares.geothermal,
            hydropower: renewable * renewableSourceShares.hydropower,
        };
    });

    /* -------------------------------------------------------------
       Supply vs Demand Dataset
       Simplified dataset used for stacked comparison charts.
       ------------------------------------------------------------- */

    const monthlySupplyDemand = monthlyEnergyBalance.map(
        ({ label, demand, renewable, grid }) => ({
            label,
            demand,
            renewable,
            grid,
        })
    );

    /* -------------------------------------------------------------
       Daily Load Profile
       Defines hourly electrical demand used in the load profile chart.
       ------------------------------------------------------------- */

    // Labels displayed on the X-axis.
    const hourlyLabels = ["00", "04", "08", "12", "16", "20"];

    // Hourly demand values (kW).
    const hourlyLoadKw = [
        45, 43, 41, 39, 39.5, 45,
        54, 63, 73, 78, 81, 84,
        83, 80, 76, 76.5, 81, 87,
        88, 83, 74, 66, 60, 52,
    ];

    // Convert load values from kW to MW.
    const dailyLoadProfile = hourlyLoadKw.map((loadKw, index) => ({
        hour: index,
        load: loadKw / 1000,
    }));

    /* -------------------------------------------------------------
       Analytics Card Datasets
       ------------------------------------------------------------- */

    // Calculate installed capacity for each renewable technology.
    const technologyCapacity = Object.keys(resourceTypeConfig).map((type) => ({
        key: type,
        label: resourceTypeConfig[type].label,
        tone: renewableSourceTones[type] || "solar",

        value: resources
            .filter((resource) => resource.type === type)
            .reduce(
                (total, resource) =>
                    total + (resource.capacityKw || 0),
                0
            ),
    }));

    // Cost breakdown used in dashboard analytics.
    const costContribution = [
        {
            key: "base",
            label: "Base operations",
            value: BASE_COST_EUR,
            tone: "base",
        },
        {
            key: "capex",
            label: "Renewable capex",
            value: amortizedCapex,
            tone: "capex",
        },
        {
            key: "savings",
            label: "Grid cost avoided",
            value: avoidedGridCost,
            tone: "savings",
        },
    ];

    /* -------------------------------------------------------------
       Chart Data Preparation
       Precompute chart values and SVG paths for efficient rendering.
       ------------------------------------------------------------- */

    // Dataset used for the energy balance chart.
    const monthlyBalanceChart = monthlyEnergyBalance.map((item, index) => ({
        ...item,
        displayLabel: `12/${String(index + 1).padStart(2, "0")}`,
        consumption: item.demand,
        renewableUse: item.renewable,
        gridImport: item.grid,
    }));

    // Legend displayed beside the balance chart.
    const activeBalanceLegend = [
        { key: "grid", label: "Grid Import", tone: "grid" },
        { key: "consumption", label: "Consumption", tone: "consumption" },
        { key: "renewable-line", label: "Renewable Use Line", tone: "renewable-line" },
    ];

    // Extract load values for plotting.
    const loadProfileSeries = dailyLoadProfile.map((item) => item.load);

    // Determine chart scaling values.
    const monthlySupplyDemandMax = Math.max(
        ...monthlySupplyDemand.map((item) => item.demand),
        1
    );

    const loadProfileMax = LOAD_PROFILE_MAX_KW / 1000;

    const balanceMax = Math.max(
        ...monthlyBalanceChart.map((item) => item.demand),
        1
    );

    const balanceAxisMax = Math.max(balanceMax, 1);

    // Generate Y-axis tick values.
    const balanceAxisTicks = [
        balanceAxisMax,
        balanceAxisMax / 2,
        0,
        -balanceAxisMax / 2,
        -balanceAxisMax,
    ];

    // Renewable usage line displayed on the balance chart.
    const balanceLineSeries = monthlyBalanceChart.map(
        (item) => item.renewableUse
    );

    // Precompute SVG line path and coordinates.
    const balanceLinePath = buildCenteredLinePath(
        balanceLineSeries,
        100,
        100,
        2,
        balanceAxisMax
    );

    const balanceLinePoints = getCenteredChartPoints(
        balanceLineSeries,
        100,
        100,
        2,
        balanceAxisMax
    );

    // Maximum values for scaling analytics charts.
    const capacityMax = Math.max(
        ...technologyCapacity.map((item) => item.value),
        1
    );

    const costContributionMax = Math.max(
        ...costContribution.map((item) => item.value),
        1
    );

    // Generate SVG paths for the load profile chart.
    const loadProfilePath = buildLinePath(
        loadProfileSeries,
        CHART_WIDTH,
        CHART_HEIGHT,
        CHART_PADDING,
        loadProfileMax
    );

    const loadProfileAreaPath = buildAreaPath(
        loadProfileSeries,
        CHART_WIDTH,
        CHART_HEIGHT,
        CHART_PADDING,
        loadProfileMax
    );

    // Generate coordinate points for chart markers.
    const loadProfilePoints = getChartPoints(
        loadProfileSeries,
        CHART_WIDTH,
        CHART_HEIGHT,
        CHART_PADDING,
        loadProfileMax
    );

    // Calculate the average load level.
    const averageLoad =
        loadProfileSeries.reduce(
            (total, value) => total + value,
            0
        ) / loadProfileSeries.length;

    // Determine the Y-coordinate for the average load line.
    const averageLoadY =
        CHART_HEIGHT -
        CHART_PADDING -
        ((averageLoad / loadProfileMax) *
            (CHART_HEIGHT - (CHART_PADDING * 2)));

    // Load profile Y-axis labels.
    const loadYAxisTicks = [0, 20, 40, 60, 80, 100].map(
        (tickKw) => tickKw / 1000
    );

    /* -------------------------------------------------------------
       Peak Demand Periods
       Define highlighted time windows in the daily load profile.
       ------------------------------------------------------------- */

    // Morning high-demand period.
    const morningPeakWindow = {
        start: 10,
        end: 13,
        label: "Morning Peak",
    };

    // Evening high-demand period.
    const eveningPeakWindow = {
        start: 16,
        end: 20,
        label: "Evening Peak",
    };

    // Horizontal spacing between chart points.
    const xStep =
        (CHART_WIDTH - (CHART_PADDING * 2)) /
        Math.max(loadProfileSeries.length - 1, 1);

    // Calculate highlight regions for peak periods.
    const peakWindows = [morningPeakWindow, eveningPeakWindow].map(
        (window) => ({
            ...window,
            x: CHART_PADDING + (window.start * xStep),
            width: Math.max(
                (window.end - window.start) * xStep,
                xStep * 1.6
            ),
        })
    );

    // Store all peak-hour indexes for quick lookup.
    const peakPointIndexes = new Set([
        ...Array.from(
            { length: morningPeakWindow.end - morningPeakWindow.start + 1 },
            (_, index) => morningPeakWindow.start + index
        ),

        ...Array.from(
            { length: eveningPeakWindow.end - eveningPeakWindow.start + 1 },
            (_, index) => eveningPeakWindow.start + index
        ),
    ]);

    /* -------------------------------------------------------------
       Flow Diagram Positioning
       Calculate the actual Y-coordinates for nodes and connectors
       using the predefined layout ratios.
    -------------------------------------------------------------- */

    const flowGridSourceY = FLOW_DIAGRAM_HEIGHT * FLOW_GRID_SOURCE_Y_RATIO;
    const flowRenewableSourceStartY = FLOW_DIAGRAM_HEIGHT * FLOW_RENEWABLE_SOURCE_START_RATIO;
    const flowRenewableSourceStepY = FLOW_DIAGRAM_HEIGHT * FLOW_RENEWABLE_SOURCE_STEP_RATIO;
    const flowHubCenterY = FLOW_DIAGRAM_HEIGHT * FLOW_HUB_CENTER_Y_RATIO;
    const flowHubToCommercialY = FLOW_DIAGRAM_HEIGHT * FLOW_HUB_TO_COMMERCIAL_Y_RATIO;
    const flowHubToResidentialY = FLOW_DIAGRAM_HEIGHT * FLOW_HUB_TO_RESIDENTIAL_Y_RATIO;
    const flowCommercialTargetY = FLOW_DIAGRAM_HEIGHT * FLOW_COMMERCIAL_TARGET_Y_RATIO;
    const flowResidentialTargetY = FLOW_DIAGRAM_HEIGHT * FLOW_RESIDENTIAL_TARGET_Y_RATIO;

    /* -------------------------------------------------------------
       Renewable Source Nodes
       Create flow diagram nodes for each renewable energy source.
    -------------------------------------------------------------- */

    const renewableSourceNodes = typeBreakdown.map((item, index) => {

        // Calculate the percentage contribution to total demand.
        const share =
            BASE_DEMAND_MWH > 0
                ? (item.output / BASE_DEMAND_MWH) * 100
                : 0;

        return {
            key: item.type,
            title: item.label,
            icon: item.icon,
            value: item.value,
            percent: formatPercent(share),
            note: `${numberFormatter.format(share)}% of demand`,
            tone: renewableSourceTones[item.type] || "solar",

            // Display resource details in the tooltip.
            tooltip: item.resources.map(
                (resource) =>
                    `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`
            ),

            // Vertical position in the flow diagram.
            y: flowRenewableSourceStartY + (index * flowRenewableSourceStepY),
        };
    });

    /* -------------------------------------------------------------
       Source Nodes
       Combine the grid supply node with all renewable source nodes.
    -------------------------------------------------------------- */

    const sourceNodes = [

        // External grid supply.
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

        // Renewable sources.
        ...renewableSourceNodes,
    ];

    /* -------------------------------------------------------------
       Flow Connections
       Define the connection labels between source nodes and the hub.
    -------------------------------------------------------------- */

    const sourceLinkCoords = sourceNodes.map((node) => ({
        key: `${node.key}-to-hub`,
        className: `${node.tone}-to-hub`,
        amount: node.value,
        percent: node.percent,

        // Badge position along the connection line.
        badgeLeft: 28,
        badgeTop: `${((node.y / FLOW_DIAGRAM_HEIGHT) * 100) - 2}%`,
    }));

    /* -------------------------------------------------------------
       Flow Diagram Legend
       Display all node categories shown in the energy flow diagram.
    -------------------------------------------------------------- */

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

    /* -------------------------------------------------------------
       Energy System Subnodes
       Display internal subsystems within the central energy hub.
    -------------------------------------------------------------- */

    const systemSubnodes = [

        // Battery storage subsystem.
        {
            key: "storage",
            label: "Storage",
            value: formatEnergy(batteryGeneration),

            note:
                batteryResources.length > 0
                    ? `${batteryResources.length} battery assets`
                    : "No battery assets configured",

            tooltip:
                batteryResources.length > 0
                    ? batteryResources.map(
                        (resource) =>
                            `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`
                    )
                    : [
                        "Battery dispatch will appear here when a battery resource is added.",
                    ],
        },

        // Inverter subsystem.
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

        // Grid interface subsystem.
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

        // Thermal energy subsystem.
        {
            key: "thermal",
            label: "Geothermal / Biomass",
            value: formatEnergy(thermalLoopOutput),

            note:
                geothermalResources.length + biomassResources.length > 0
                    ? `${geothermalResources.length + biomassResources.length} thermal renewable assets`
                    : "No geothermal or biomass assets configured",

            tooltip: [
                `Geothermal output • ${formatEnergy(geothermalGeneration)}`,
                `Biomass output • ${formatEnergy(biomassGeneration)}`,
            ],
        },

        // Hydropower subsystem.
        {
            key: "water",
            label: "Hydropower",
            value: formatEnergy(hydropowerGeneration),

            note:
                hydropowerResources.length > 0
                    ? `${hydropowerResources.length} hydropower assets`
                    : "No hydropower assets configured",

            tooltip:
                hydropowerResources.length > 0
                    ? hydropowerResources.map(
                        (resource) =>
                            `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`
                    )
                    : [
                        "Hydropower contribution appears here when hydropower assets are added.",
                    ],
        },
    ];

    /* -------------------------------------------------------------
       Demand Nodes
       Define the final energy consumers displayed on the right side
       of the flow diagram.
    -------------------------------------------------------------- */

    const demandNodes = [

        // Commercial buildings.
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

        // Residential buildings.
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

    /* -------------------------------------------------------------
       Flow Connections
       Combine all energy flow links between source nodes, the central
       energy system, and the demand nodes.
    -------------------------------------------------------------- */

    const flowLinks = [

        // Connections from energy sources to the central hub.
        ...sourceLinkCoords,

        // Connection from hub to commercial consumers.
        {
            key: "hub-to-commercial",
            className: "hub-to-commercial",
            amount: formatEnergy(commercialDemand),
            percent: formatPercent(commercialDemandShare),
            badgeRight: 21,
            badgeTop: "18%",
        },

        // Connection from hub to residential consumers.
        {
            key: "hub-to-residential",
            className: "hub-to-residential",
            amount: formatEnergy(residentialDemand),
            percent: formatPercent(residentialDemandShare),
            badgeRight: 20,
            badgeTop: "64%",
        },
    ];

    /* -------------------------------------------------------------
       Export Function
       Exports the energy flow diagram as either a PNG image or PDF.
    -------------------------------------------------------------- */

    async function handleExport(format) {

        // Prevent export if no diagram exists or another export is in progress.
        if (!diagramExportRef.current || exportingFormat) {
            return;
        }

        try {

            // Store the selected export format.
            setExportingFormat(format);

            // Convert the diagram into a high-quality PNG image.
            const dataUrl = await toPng(diagramExportRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: "#ffffff",
            });

            // Download the diagram directly as a PNG image.
            if (format === "png") {

                const link = document.createElement("a");
                link.download = "energy-flow-diagram.png";
                link.href = dataUrl;
                link.click();

                return;
            }

            // Create a landscape PDF and insert the exported image.
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "px",
                format: [1240, 860],
            });

            pdf.addImage(dataUrl, "PNG", 20, 20, 1200, 820);
            pdf.save("energy-flow-diagram.pdf");
        } catch (error) {

            // Display any export errors in the browser console.
            console.error("Failed to export diagram", error);
        } finally {

            // Reset export state after completion.
            setExportingFormat("");
        }
    }

    return (

        /* -------------------------------------------------------------
           Main Dashboard Layout
           Contains KPI cards, flow diagram, analytics panels,
           and the optional interactive map.
        -------------------------------------------------------------- */

        <main className="energy-home">

            {/* Application branding section */}
            <header className="dashboard-header brand-header">

                <div className="brand-mark" aria-label="EnerPlanET">

                    {/* Main application logo */}
                    <span className="brand-mark-main">EnerPlan</span>

                    {/* Highlighted logo suffix */}
                    <span className="brand-mark-accent">ET</span>

                </div>

            </header>

            {/* ---------------------------------------------------------
                KPI Summary Cards
                Displays the main dashboard performance indicators.
            ---------------------------------------------------------- */}

            <section className="kpi-row">

                {kpis.map((item) => (

                    <article className="kpi-card-2" key={item.title}>

                        {/* KPI icon */}
                        <div className="kpi-icon">
                            {item.icon}
                        </div>

                        {/* KPI details */}
                        <div>
                            <p>{item.title}</p>
                            <h3>{item.value}</h3>
                            <span>{item.note}</span>
                        </div>

                    </article>

                ))}

            </section>

            {/* ---------------------------------------------------------
                Main Dashboard Content
                Displays the flow diagram, charts, and map.
            ---------------------------------------------------------- */}

            <section className="main-layout">

                <div className="control-board">

                    <div className="flow-column">

                        {/* Energy flow visualization panel */}
                        <article
                            className="panel pipeline-panel"
                            data-chatbot-section="energy-flow-diagram"
                        >

                            {/* Panel title and export controls */}
                            <div className="panel-head energy-flow-head">

                                <div>

                                    <h3>Energy Flow Diagram</h3>

                                    <p>
                                        Flow with amounts and percentages across
                                        sources, the energy system, and connected loads.
                                    </p>

                                </div>

                                {/* Export buttons */}
                                <div className="flow-head-actions">

                                    {/* Time period indicator */}
                                    <span className="flow-period">
                                        30 days
                                    </span>

                                    {/* PNG export */}
                                    <button
                                        className="secondary-btn"
                                        type="button"
                                        disabled={exportingFormat !== ""}
                                        onClick={() => handleExport("png")}
                                    >
                                        {exportingFormat === "png"
                                            ? "Exporting PNG..."
                                            : "Export PNG"}
                                    </button>

                                    {/* PDF export */}
                                    <button
                                        className="secondary-btn"
                                        type="button"
                                        disabled={exportingFormat !== ""}
                                        onClick={() => handleExport("pdf")}
                                    >
                                        {exportingFormat === "pdf"
                                            ? "Exporting PDF..."
                                            : "Export PDF"}
                                    </button>

                                </div>

                            </div>

                            {/* -------------------------------------------------
                                Exportable Diagram Surface
                                Everything inside this container is exported.
                            -------------------------------------------------- */}

                            <div
                                className="diagram-export-surface"
                                ref={diagramExportRef}
                            >

                                {/* Flow diagram container */}
                                <div
                                    className="node-link-board"
                                    aria-label="energy flow diagram"
                                >

                                    {/* SVG lines representing energy flow paths */}
                                    <svg
                                        className="flow-network-lines"
                                        viewBox={`0 0 1000 ${FLOW_DIAGRAM_HEIGHT}`}
                                        preserveAspectRatio="none"
                                        aria-hidden="true"
                                    >

                                        {/* Source-to-hub connections */}
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

                                        {/* Hub-to-commercial connection */}
                                        <line
                                            className="flow-line-svg commercial"
                                            x1="570"
                                            y1={flowHubToCommercialY}
                                            x2="830"
                                            y2={flowCommercialTargetY}
                                        />

                                        {/* Hub-to-residential connection */}
                                        <line
                                            className="flow-line-svg residential"
                                            x1="570"
                                            y1={flowHubToResidentialY}
                                            x2="830"
                                            y2={flowResidentialTargetY}
                                        />

                                    </svg>

                                    {/* -------------------------------------------------------------
                                       Source Nodes
                                       Display the grid and renewable energy sources on the left side
                                       of the energy flow diagram.
                                    -------------------------------------------------------------- */}

                                    {sourceNodes.map((node) => (

                                        <article
                                            className={`flow-node-card flow-source-node ${node.tone}`}
                                            key={node.key}
                                            style={{
                                                left: "2.5%",
                                                top: `${(node.y / FLOW_DIAGRAM_HEIGHT) * 100}%`,
                                            }}
                                        >

                                            {/* Source icon */}
                                            <div className="flow-node-icon">
                                                {node.icon}
                                            </div>

                                            {/* Source details */}
                                            <div className="flow-node-copy">
                                                <span className="flow-label">{node.title}</span>
                                                <strong>{node.value}</strong>
                                                <small>{node.percent} · {node.note}</small>
                                            </div>

                                            {/* Tooltip showing additional source information */}
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

                                    {/* -------------------------------------------------------------
                                       Energy System Hub
                                       Displays the central energy system and its internal
                                       subsystems.
                                    -------------------------------------------------------------- */}

                                    <article className="flow-node-card hub hub-center">

                                        {/* Hub icon */}
                                        <div className="flow-node-icon">
                                            ⚙
                                        </div>

                                        {/* Overall system information */}
                                        <div className="flow-node-copy">

                                            <span className="flow-label">
                                                Energy System
                                            </span>

                                            <strong>
                                                {formatEnergy(BASE_DEMAND_MWH)}
                                            </strong>

                                            <small>
                                                {numberFormatter.format(100)}% system balancing target
                                            </small>

                                        </div>

                                        {/* Internal energy system components */}
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

                                    {/* -------------------------------------------------------------
                                       Demand Nodes
                                       Display commercial and residential energy consumers on the
                                       right side of the flow diagram.
                                    -------------------------------------------------------------- */}

                                    {demandNodes.map((node) => (

                                        <article
                                            className={`flow-node-card ${node.tone} ${node.position}`}
                                            key={node.key}
                                        >

                                            {/* Consumer icon */}
                                            <div className="flow-node-icon">
                                                {node.icon}
                                            </div>

                                            {/* Consumer details */}
                                            <div className="flow-node-copy">

                                                <span className="flow-label">
                                                    {node.title}
                                                </span>

                                                <strong>{node.value}</strong>

                                                <small>{node.percent} · {node.note}</small>

                                            </div>

                                            {/* Tooltip showing demand information */}
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

                                    {/* -------------------------------------------------------------
                                       Flow Badges
                                       Display the energy amount and percentage on each connection
                                       between nodes.
                                    -------------------------------------------------------------- */}

                                    {flowLinks.map((link) => (

                                        <div
                                            className={`flow-link-path ${link.className}`}
                                            key={link.key}
                                            aria-hidden="true"

                                            style={
                                                link.badgeRight !== undefined
                                                    ? {
                                                        right: `${link.badgeRight}%`,
                                                        top: link.badgeTop,
                                                    }
                                                    : {
                                                        left: `${link.badgeLeft}%`,
                                                        top: link.badgeTop,
                                                    }
                                            }
                                        >

                                            {/* Flow value badge */}
                                            <div className="flow-link-badge">

                                                <strong>{link.amount}</strong>

                                                <span>{link.percent}</span>

                                            </div>

                                        </div>

                                    ))}

                                    {/* -------------------------------------------------------------
                                       Diagram Legend
                                       Shows the colour mapping for each energy source and demand
                                       category.
                                    -------------------------------------------------------------- */}

                                    <div
                                        className="flow-legend"
                                        aria-label="diagram legend"
                                    >

                                        {legendItems.map((item) => (

                                            <div
                                                className="flow-legend-item"
                                                key={item.key}
                                            >

                                                {/* Legend colour indicator */}
                                                <span
                                                    className={`flow-legend-swatch ${item.tone}`}
                                                />

                                                {/* Legend label */}
                                                <span>{item.label}</span>

                                            </div>

                                        ))}

                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>

                    {/* -------------------------------------------------------------
                       Analytics Panel
                       Displays analytical charts summarizing energy generation,
                       consumption, and system performance.
                    -------------------------------------------------------------- */}

                    <aside
                        className="analytics-rail"
                        aria-label="energy analytics"
                    >

                        {/* Supply versus demand chart */}
                        <article
                            className="panel analytics-card analytics-card-large"
                            data-chatbot-section="supply-vs-demand"
                        >

                            {/* Chart heading */}
                            <div className="panel-head analytics-head">

                                <div>

                                    <h3>Supply vs Demand</h3>

                                    <p>
                                        30-day demand view showing how renewable supply
                                        and grid import combine to meet daily demand.
                                    </p>

                                </div>

                            </div>

                            {/* Container for the 30-day Supply vs Demand chart */}
                            <div className="chart-shell supply-demand-shell">

                                {/* Displays one column for each day in the month */}
                                <div
                                    className="supply-demand-bars"
                                    role="img"
                                    aria-label="30 day supply versus demand chart"
                                >
                                    {monthlySupplyDemand.map((item, index) => (
                                        // Each column represents one day's energy data
                                        <div
                                            className="supply-demand-column"
                                            key={item.label}
                                            tabIndex={0}
                                        >
                                            <div className="supply-demand-bar-wrap">

                                                {/* Horizontal line indicating the day's total energy demand */}
                                                <span
                                                    className="supply-demand-demand-line"
                                                    style={{
                                                        bottom: `${(item.demand / monthlySupplyDemandMax) * 100}%`
                                                    }}
                                                />

                                                {/* Stacked supply bar */}
                                                <div className="supply-demand-bar">

                                                    {/* Renewable energy contribution */}
                                                    <span
                                                        className="supply-demand-segment renewable"
                                                        style={{
                                                            height: `${(item.renewable / monthlySupplyDemandMax) * 100}%`
                                                        }}
                                                    />

                                                    {/* Grid electricity contribution */}
                                                    <span
                                                        className="supply-demand-segment grid"
                                                        style={{
                                                            height: `${(item.grid / monthlySupplyDemandMax) * 100}%`
                                                        }}
                                                    />
                                                </div>

                                                {/* Tooltip shown when hovering over a day's column */}
                                                <div className="chart-hover-card supply-demand-tooltip">
                                                    <strong>Day {index + 1}</strong>
                                                    <span>Demand: {formatEnergyKwh(item.demand)}</span>
                                                    <span>Renewables: {formatEnergyKwh(item.renewable)}</span>
                                                    <span>Grid import: {formatEnergyKwh(item.grid)}</span>
                                                </div>
                                            </div>

                                            {/* Displays the day number below each column */}
                                            <span className="supply-demand-label">
                                                {index + 1}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Displays the chart legend to identify the meaning of each colour and line style */}
                                <div className="chart-legend compact">
                                    {/* Indicates the line representing total daily energy demand */}
                                    <span><i className="legend-dot demand-line" /> Total demand</span>

                                    {/* Indicates the renewable energy contribution */}
                                    <span><i className="legend-dot supply-line" /> Renewable supply</span>

                                    {/* Indicates the energy imported from the electrical grid */}
                                    <span><i className="legend-dot grid" /> Grid import</span>
                                </div>

                                {/* Displays summary statistics for the 30-day supply and demand analysis */}
                                <div className="chart-summary-grid">
                                    <div>
                                        {/* Shows the day with the highest energy demand */}
                                        <span>Peak demand day</span>

                                        {/* Finds the day with the maximum demand using the reduce() function */}
                                        <strong>
                                            {monthlySupplyDemand.reduce(
                                                (peak, item) => (item.demand > peak.demand ? item : peak),
                                                monthlySupplyDemand[0]
                                            ).label}
                                        </strong>
                                    </div>

                                    <div>
                                        {/* Displays the percentage of total energy supplied by renewable sources */}
                                        <span>30 day renewable share</span>
                                        <strong>{formatPercent(renewableShare)}</strong>
                                    </div>
                                </div>
                            </div>
                        </article>

                        {/* Displays the Daily Energy Balance chart with positive grid imports,
                            negative consumption values, and an overlay line showing renewable energy usage */}
                        <article className="panel analytics-card analytics-card-medium">

                            {/* Chart title and description */}
                            <div className="panel-head analytics-head">
                                <div>
                                    <h3>Daily Energy Balance</h3>
                                    <p>
                                        Monthly balance view with grid import above zero,
                                        consumption below zero, and a renewable-use line.
                                    </p>
                                </div>
                            </div>

                            {/* Main container for the energy balance chart */}
                            <div className="balance-chart-shell">

                                {/* Left Y-axis displaying energy values in kWh */}
                                <div className="balance-y-axis" aria-hidden="true">
                                    <span>{formatEnergyKwh(balanceAxisTicks[0])}</span>
                                    <span>{formatEnergyKwh(balanceAxisTicks[1])}</span>
                                    <span>0 kWh</span>
                                    <span>-{formatEnergyKwh(Math.abs(balanceAxisTicks[3])).replace(" kWh", "")}</span>
                                    <span>-{formatEnergyKwh(Math.abs(balanceAxisTicks[4])).replace(" kWh", "")}</span>
                                </div>

                                {/* Main plotting area */}
                                <div className="balance-chart-stage">

                                    {/* Displays the titles for both Y-axes */}
                                    <div className="balance-axis-head">
                                        <div className="balance-y-axis-title">
                                            Energy (kWh)
                                        </div>

                                        <div className="balance-y-axis-title balance-y-axis-title-right">
                                            Renewables (kWh)
                                        </div>
                                    </div>

                                    {/* Chart frame containing grid lines, zero line, bars, and overlay line */}
                                    <div className="balance-chart-frame">

                                        {/* Horizontal guide lines to improve chart readability */}
                                        <div className="balance-grid-lines" aria-hidden="true">
                                            {[0, 1, 2, 3, 4].map((line) => (
                                                <span
                                                    key={line}
                                                    className="balance-grid-line"
                                                />
                                            ))}
                                        </div>

                                        {/* Horizontal zero reference line separating positive and negative values */}
                                        <span
                                            className="balance-zero-line"
                                            aria-hidden="true"
                                        />

                                        {/* SVG overlay used to draw the renewable energy trend line */}
                                        <svg
                                            className="balance-net-overlay"
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none"
                                            aria-hidden="true"
                                        >
                                            {/* Draws the renewable energy line */}
                                            <path
                                                className="balance-net-line"
                                                d={balanceLinePath}
                                            />

                                            {/* Displays circular markers at each daily data point */}
                                            {balanceLinePoints.map((point, index) => (
                                                <circle
                                                    className="balance-net-point"
                                                    key={monthlyBalanceChart[index].label}
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r="0.75"
                                                />
                                            ))}
                                        </svg>

                                        {/* Displays the daily energy balance bars */}
                                        <div
                                            className="balance-chart"
                                            role="img"
                                            aria-label="Daily energy balance by day of month"
                                        >
                                            {monthlyBalanceChart.map((item) => (

                                                /* Represents one day's energy data */
                                                <div
                                                    className="balance-column"
                                                    key={item.label}
                                                    tabIndex={0}
                                                >
                                                    <div className="balance-stack-wrap">

                                                        {/* Positive section showing imported grid energy */}
                                                        <div className="balance-positive-zone">
                                                            <div className="balance-positive-stack">
                                                                <span
                                                                    className="balance-segment grid"
                                                                    style={{
                                                                        height: `${(item.gridImport / balanceAxisMax) * 100}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Negative section showing daily energy consumption */}
                                                        <div className="balance-negative-zone">
                                                            <span
                                                                className="balance-consumption-bar"
                                                                style={{
                                                                    height: `${(item.consumption / balanceAxisMax) * 100}%`
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Tooltip displaying detailed values when hovering over a day's column */}
                                                        <div className="chart-hover-card balance-tooltip">
                                                            <strong>{item.displayLabel}</strong>
                                                            <span>
                                                                Consumption: {formatEnergyKwh(item.consumption)}
                                                            </span>
                                                            <span>
                                                                Renewable use: {formatEnergyKwh(item.renewableUse)}
                                                            </span>
                                                            <span>
                                                                Grid import: {formatEnergyKwh(item.gridImport)}
                                                            </span>
                                                        </div>

                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Displays selected day labels along the X-axis */}
                                    <div
                                        className="balance-axis-labels"
                                        aria-hidden="true"
                                    >
                                        {monthlyBalanceChart.map((item, index) => (
                                            <span key={item.label}>
                                                {index % 3 === 0 ||
                                                    index === monthlyBalanceChart.length - 1
                                                    ? item.displayLabel
                                                    : ""}
                                            </span>
                                        ))}
                                    </div>

                                    {/* X-axis title */}
                                    <div className="balance-x-axis-title">
                                        Days of month
                                    </div>

                                </div>
                            </div>

                            {/* Legend describing each chart element */}
                            <div className="chart-legend balance-legend">
                                {activeBalanceLegend.map((item) => (
                                    <span key={item.key}>
                                        <i className={`legend-dot ${item.tone}`} />
                                        {item.label}
                                    </span>
                                ))}
                            </div>

                        </article>

                    </aside>
                </div>

                {/* Displays the lower dashboard containing additional energy analytics cards */}
                <div className="analytics-mini-grid analytics-mini-grid-wide analytics-mini-grid-triple">

                    {/* Card showing the average daily power demand profile */}
                    <article className="panel analytics-card analytics-card-small">

                        {/* Card heading */}
                        <div className="panel-head analytics-head">
                            <div>
                                <h3>Daily Load Profile</h3>
                                <p>
                                    Average day power profile with peak periods,
                                    average band, and point hover details.
                                </p>
                            </div>
                        </div>

                        {/* Container for the load profile chart */}
                        <div className="chart-shell mini-shell load-profile-shell">

                            <div className="load-profile-layout">

                                {/* Y-axis displaying power values in kilowatts */}
                                <div
                                    className="load-profile-y-axis"
                                    aria-hidden="true"
                                >
                                    {loadYAxisTicks.slice().reverse().map((tick) => (
                                        <span key={tick}>
                                            {formatPowerKw(tick)}
                                        </span>
                                    ))}
                                </div>

                                {/* Main container for the Daily Load Profile chart */}
                                <div className="load-profile-stage">

                                    {/* SVG used to draw the load profile line chart */}
                                    <svg
                                        className="line-chart load-profile-chart"
                                        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                                        role="img"
                                        aria-label="Daily load profile chart"
                                    >

                                        {/* Draws horizontal grid lines based on the Y-axis tick values */}
                                        {loadYAxisTicks.slice(1).map((tick) => {
                                            const y =
                                                CHART_HEIGHT -
                                                CHART_PADDING -
                                                ((tick / loadProfileMax) *
                                                    (CHART_HEIGHT - (CHART_PADDING * 2)));

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

                                        {/* Highlights peak demand periods using shaded background bands */}
                                        {peakWindows.map((window) => (
                                            <g key={window.label}>

                                                {/* Shaded area representing a peak time window */}
                                                <rect
                                                    className="load-peak-band"
                                                    x={window.x}
                                                    y={CHART_PADDING}
                                                    width={window.width}
                                                    height={CHART_HEIGHT - (CHART_PADDING * 2)}
                                                />

                                                {/* Label displayed above each highlighted peak period */}
                                                <text
                                                    className="load-peak-label"
                                                    x={window.x + (window.width / 2)}
                                                    y={CHART_PADDING - 6}
                                                >
                                                    {window.label}
                                                </text>

                                            </g>
                                        ))}

                                        {/* Draws the filled area beneath the load profile line */}
                                        <path
                                            className="chart-area load-area"
                                            d={loadProfileAreaPath}
                                        />

                                        {/* Displays the average load as a horizontal reference line */}
                                        <line
                                            className="load-average-line"
                                            x1={CHART_PADDING}
                                            x2={CHART_WIDTH - CHART_PADDING}
                                            y1={averageLoadY}
                                            y2={averageLoadY}
                                        />

                                        {/* Labels the average load line */}
                                        <text
                                            className="load-average-label"
                                            x={CHART_WIDTH - CHART_PADDING + 10}
                                            y={averageLoadY + 4}
                                        >
                                            Avg
                                        </text>

                                        {/* Draws the main load profile line */}
                                        <path
                                            className="chart-line load-line"
                                            d={loadProfilePath}
                                        />

                                        {/* Creates data point markers and tooltips for each hourly load value */}
                                        {loadProfilePoints.map((point, index) => (

                                            <g
                                                className="load-point-group"
                                                key={dailyLoadProfile[index].hour}
                                            >

                                                {(() => {

                                                    // Width of the tooltip box
                                                    const tooltipWidth = 92;

                                                    // Prevents the tooltip from overflowing beyond the chart boundaries
                                                    const tooltipCenterX = Math.min(
                                                        CHART_WIDTH - (tooltipWidth / 2) - 4,
                                                        Math.max((tooltipWidth / 2) + 4, point.x),
                                                    );

                                                    return (
                                                        <>

                                                            {/* Displays a point marker on the load profile line */}
                                                            <circle
                                                                className={`load-point ${peakPointIndexes.has(index)
                                                                    ? "peak"
                                                                    : "base"
                                                                    }`}
                                                                cx={point.x}
                                                                cy={point.y}
                                                                r="3.2"
                                                            />

                                                            {/* Tooltip displayed when hovering over a data point */}
                                                            <g className="load-point-tooltip">

                                                                {/* Tooltip background */}
                                                                <rect
                                                                    x={tooltipCenterX - (tooltipWidth / 2)}
                                                                    y={point.y - 46}
                                                                    rx="9"
                                                                    ry="9"
                                                                    width={tooltipWidth}
                                                                    height="32"
                                                                />

                                                                {/* Displays the hour */}
                                                                <text
                                                                    x={tooltipCenterX}
                                                                    y={point.y - 30}
                                                                >
                                                                    {`${String(
                                                                        dailyLoadProfile[index].hour
                                                                    ).padStart(2, "0")}:00`}
                                                                </text>

                                                                {/* Displays the corresponding load value */}
                                                                <text
                                                                    x={tooltipCenterX}
                                                                    y={point.y - 18}
                                                                >
                                                                    {formatPowerKw(
                                                                        dailyLoadProfile[index].load
                                                                    )}
                                                                </text>

                                                            </g>

                                                        </>
                                                    );

                                                })()}

                                            </g>
                                        ))}

                                    </svg>

                                    {/* Displays hour labels along the X-axis */}
                                    <div
                                        className="load-profile-x-axis"
                                        aria-hidden="true"
                                    >
                                        {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                                            <span key={hour}>
                                                {`${String(hour).padStart(2, "0")}:00`}
                                            </span>
                                        ))}
                                    </div>

                                    {/* X-axis title */}
                                    <div className="load-profile-x-title">
                                        Time of Day
                                    </div>

                                </div>
                            </div>
                        </div>
                    </article>

                    {/* Card displaying the installed capacity of each energy technology */}
                    <article className="panel analytics-card analytics-card-small analytics-card-compact">

                        {/* Card heading */}
                        <div className="panel-head analytics-head">
                            <div>
                                <h3>Technology Capacity</h3>
                                <p>Installed capacity by technology.</p>
                            </div>
                        </div>

                        {/* List of technology capacities */}
                        <div className="capacity-list">

                            {/* Generates one capacity bar for each technology */}
                            {technologyCapacity.map((item) => (

                                <div
                                    className="capacity-row"
                                    key={item.key}
                                >

                                    {/* Displays the technology name and installed capacity */}
                                    <div className="capacity-meta">
                                        <span>{item.label}</span>
                                        <strong>
                                            {numberFormatter.format(item.value)} kW
                                        </strong>
                                    </div>

                                    {/* Progress bar representing the installed capacity */}
                                    <div className="capacity-bar-track">
                                        <span
                                            className={`capacity-bar ${item.tone}`}
                                            style={{
                                                width: `${capacityMax > 0
                                                    ? (item.value / capacityMax) * 100
                                                    : 0
                                                    }%`
                                            }}
                                        />
                                    </div>

                                </div>

                            ))}
                        </div>
                    </article>

                    {/* Cost composition bars and net total summary panel */}
                    <article className="panel analytics-card analytics-card-small analytics-card-compact">
                        {/* Panel header with title and description */}
                        <div className="panel-head analytics-head">
                            <div>
                                <h3>Cost Contribution</h3>
                                <p>Monthly cost drivers and renewable offset.</p>
                            </div>
                        </div>

                        {/* List of cost breakdown items */}
                        <div className="cost-list">
                            {/* Render each cost category as a row with a bar visualization */}
                            {costContribution.map((item) => (
                                <div className="cost-row" key={item.key}>
                                    {/* Displays cost label and formatted value */}
                                    <div className="cost-meta">
                                        <span>{item.label}</span>
                                        <strong>{formatCurrency(item.value)}</strong>
                                    </div>

                                    {/* Visual bar representing proportion of each cost item */}
                                    <div className="cost-bar-track">
                                        <span
                                            className={`cost-bar ${item.tone}`}
                                            style={{
                                                width: `${costContributionMax > 0
                                                    ? (item.value / costContributionMax) * 100
                                                    : 0
                                                    }%`
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Displays final calculated net total cost */}
                            <div className="cost-total-row">
                                <span>Net total cost</span>
                                <strong>{formatCurrency(totalCost)}</strong>
                            </div>
                        </div>
                    </article>
                </div>

                {/* Section controlling the optional map view */}
                <section className="map-section">

                    {/* Header section with title, description, and toggle button */}
                    <div className="map-section-head">
                        <div>
                            <h3>Asset map</h3>
                            <p>
                                Keep the map hidden until you need a spatial view of the system.
                            </p>
                        </div>

                        {/* Button toggles map visibility state */}
                        <button
                            className="secondary-btn map-toggle-btn"
                            type="button"
                            onClick={() => setShowMap((currentValue) => !currentValue)}
                        >
                            {/* Dynamic button label based on current state */}
                            {showMap ? "Hide map" : "Show map"}
                        </button>
                    </div>

                    {/* Conditionally render map or placeholder based on showMap state */}
                    {showMap ? (

                        /* Map panel shown when enabled */
                        <article className="panel map-panel">

                            {/* Small label indicating map view */}
                            <div className="map-hint">Map view</div>

                            {/* Map zoom and reset controls */}
                            <div className="map-controls">
                                <button type="button" onClick={() => mapRef.current?.zoomIn()}>＋</button>
                                <button type="button" onClick={() => mapRef.current?.zoomOut()}>－</button>
                                <button type="button" onClick={() => mapRef.current?.resetView()}>◎</button>
                            </div>

                            {/* OpenLayers map component (interactive spatial visualization) */}
                            <OpenLayersMap ref={mapRef} />
                        </article>
                    ) : (

                        /* Placeholder shown when map is hidden */
                        <div className="map-collapsed-state">
                            The map is hidden by default. Open it when you need to inspect site geography and asset placement.
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}

/* Exporting the main App component as default */
export default App;
