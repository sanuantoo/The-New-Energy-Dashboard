import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { useRef, useState } from "react";
import "./App.css";
import OpenLayersMap from "./components/OpenLayersMap";

const BASE_DEMAND_MWH = 45.19;
const BASE_COST_EUR = 14292;
const GRID_ENERGY_RATE = 210;
const MONTHLY_CAPEX_FACTOR = 0.012;
const FLOW_DIAGRAM_HEIGHT = 820;

const numberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const commonFields = [
    { name: "name", label: "Resource name", type: "text", placeholder: "North roof PV" },
    { name: "site", label: "Site", type: "text", placeholder: "Munich campus" },
    { name: "capacityKw", label: "Installed capacity", type: "number", suffix: "kW" },
    { name: "annualOutputMWh", label: "Expected output", type: "number", suffix: "MWh" },
    { name: "investmentCost", label: "Investment cost", type: "number", suffix: "EUR" },
    {
        name: "status",
        label: "Status",
        type: "select",
        options: ["planned", "active", "offline"],
    },
];

const resourceTypeConfig = {
    pv: {
        label: "PV",
        icon: "☀",
        description: "Panels, tilt, orientation, and inverter sizing.",
        defaults: {
            name: "",
            site: "",
            capacityKw: "100",
            annualOutputMWh: "18",
            investmentCost: "65000",
            status: "planned",
            panelCount: "240",
            tilt: "20",
            azimuth: "180",
            mountType: "roof",
        },
        fields: [
            { name: "panelCount", label: "Panel count", type: "number" },
            { name: "tilt", label: "Tilt angle", type: "number", suffix: "deg" },
            { name: "azimuth", label: "Orientation", type: "number", suffix: "deg" },
            {
                name: "mountType",
                label: "Mount type",
                type: "select",
                options: ["roof", "ground"],
            },
        ],
    },
    wind: {
        label: "Wind",
        icon: "🌀",
        description: "Turbines, wind regime, and expected capacity factor.",
        defaults: {
            name: "",
            site: "",
            capacityKw: "250",
            annualOutputMWh: "32",
            investmentCost: "110000",
            status: "planned",
            turbineCount: "2",
            hubHeight: "80",
            averageWindSpeed: "6.5",
            capacityFactor: "28",
        },
        fields: [
            { name: "turbineCount", label: "Turbine count", type: "number" },
            { name: "hubHeight", label: "Hub height", type: "number", suffix: "m" },
            { name: "averageWindSpeed", label: "Average wind speed", type: "number", suffix: "m/s" },
            { name: "capacityFactor", label: "Capacity factor", type: "number", suffix: "%" },
        ],
    },
    battery: {
        label: "Battery",
        icon: "🔋",
        description: "Storage capacity, reserve policy, and dispatch support.",
        defaults: {
            name: "",
            site: "",
            capacityKw: "80",
            annualOutputMWh: "12",
            investmentCost: "42000",
            status: "planned",
            storageKWh: "160",
            chargeRateKw: "60",
            reservePercent: "20",
            roundTripEfficiency: "92",
        },
        fields: [
            { name: "storageKWh", label: "Storage capacity", type: "number", suffix: "kWh" },
            { name: "chargeRateKw", label: "Charge rate", type: "number", suffix: "kW" },
            { name: "reservePercent", label: "Reserve target", type: "number", suffix: "%" },
            { name: "roundTripEfficiency", label: "Round-trip efficiency", type: "number", suffix: "%" },
        ],
    },
    biomass: {
        label: "Biomass",
        icon: "🌿",
        description: "Feedstock, conversion efficiency, and run hours.",
        defaults: {
            name: "",
            site: "",
            capacityKw: "120",
            annualOutputMWh: "24",
            investmentCost: "90000",
            status: "planned",
            feedstock: "wood chips",
            availability: "85",
            conversionEfficiency: "38",
            operatingHours: "4200",
        },
        fields: [
            { name: "feedstock", label: "Feedstock", type: "text", placeholder: "wood chips" },
            { name: "availability", label: "Fuel availability", type: "number", suffix: "%" },
            { name: "conversionEfficiency", label: "Conversion efficiency", type: "number", suffix: "%" },
            { name: "operatingHours", label: "Operating hours", type: "number", suffix: "h/yr" },
        ],
    },
    geothermal: {
        label: "Geothermal",
        icon: "🌋",
        description: "Well depth, source temperature, and thermal conversion.",
        defaults: {
            name: "",
            site: "",
            capacityKw: "140",
            annualOutputMWh: "26",
            investmentCost: "125000",
            status: "planned",
            wellDepth: "1800",
            reservoirTemperature: "92",
            reinjectionRate: "85",
            plantType: "binary",
        },
        fields: [
            { name: "wellDepth", label: "Well depth", type: "number", suffix: "m" },
            { name: "reservoirTemperature", label: "Source temperature", type: "number", suffix: "C" },
            { name: "reinjectionRate", label: "Reinjection rate", type: "number", suffix: "%" },
            {
                name: "plantType",
                label: "Plant type",
                type: "select",
                options: ["binary", "flash"],
            },
        ],
    },
    hydropower: {
        label: "Hydropower",
        icon: "💧",
        description: "Head, flow rate, and turbine conversion for water supply.",
        defaults: {
            name: "",
            site: "",
            capacityKw: "160",
            annualOutputMWh: "30",
            investmentCost: "135000",
            status: "planned",
            waterHead: "34",
            flowRate: "1.8",
            turbineType: "francis",
            seasonalAvailability: "78",
        },
        fields: [
            { name: "waterHead", label: "Water head", type: "number", suffix: "m" },
            { name: "flowRate", label: "Flow rate", type: "number", suffix: "m3/s" },
            {
                name: "turbineType",
                label: "Turbine type",
                type: "select",
                options: ["francis", "kaplan", "pelton"],
            },
            { name: "seasonalAvailability", label: "Seasonal availability", type: "number", suffix: "%" },
        ],
    },
};

const initialType = "pv";
const plannerEligibleTypes = ["pv", "wind", "biomass", "geothermal", "hydropower"];

function createFormState(type) {
    return {
        type,
        ...resourceTypeConfig[type].defaults,
    };
}

function toNumber(value) {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatEnergy(value) {
    return `${numberFormatter.format(Math.max(value, 0))} MWh`;
}

function formatCurrency(value) {
    return currencyFormatter.format(Math.max(value, 0));
}

function formatPercent(value) {
    return `${numberFormatter.format(Math.max(value, 0))}%`;
}

function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPlannerNumber(value, maximumFractionDigits = 0) {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    }).format(Math.max(value, 0));
}

function buildSelfSufficiencyPlan(type, targetOutputMWh) {
    const config = resourceTypeConfig[type];
    const defaults = config.defaults;
    const baseOutput = Math.max(toNumber(defaults.annualOutputMWh), 0.1);
    const scale = targetOutputMWh > 0 ? targetOutputMWh / baseOutput : 0;
    const capacityKw = toNumber(defaults.capacityKw) * scale;
    const investmentCost = toNumber(defaults.investmentCost) * scale;

    const plan = {
        type,
        label: config.label,
        icon: config.icon,
        scale,
        formValues: {
            capacityKw: capacityKw.toFixed(0),
            annualOutputMWh: targetOutputMWh.toFixed(2),
            investmentCost: investmentCost.toFixed(0),
        },
        details: [
            { label: "Installed capacity", value: `${formatPlannerNumber(capacityKw)} kW` },
            { label: "Expected output", value: `${formatPlannerNumber(targetOutputMWh, 2)} MWh` },
            { label: "Investment cost", value: currencyFormatter.format(investmentCost) },
        ],
        notes: [],
    };

    switch (type) {
        case "pv": {
            const panelCount = Math.max(Math.round(toNumber(defaults.panelCount) * scale), 1);
            plan.formValues.panelCount = String(panelCount);
            plan.formValues.tilt = defaults.tilt;
            plan.formValues.azimuth = defaults.azimuth;
            plan.formValues.mountType = defaults.mountType;
            plan.details.push(
                { label: "Panel count", value: `${formatPlannerNumber(panelCount)} panels` },
                { label: "Tilt angle", value: `${defaults.tilt} deg` },
                { label: "Orientation", value: `${defaults.azimuth} deg` },
                { label: "Mount type", value: titleCase(defaults.mountType) },
            );
            plan.notes.push("PV planning scales panel count and inverter-side capacity from the target output.");
            break;
        }
        case "wind": {
            const turbineCount = Math.max(Math.round(toNumber(defaults.turbineCount) * scale), 1);
            plan.formValues.turbineCount = String(turbineCount);
            plan.formValues.hubHeight = defaults.hubHeight;
            plan.formValues.averageWindSpeed = defaults.averageWindSpeed;
            plan.formValues.capacityFactor = defaults.capacityFactor;
            plan.details.push(
                { label: "Turbine count", value: `${formatPlannerNumber(turbineCount)} turbines` },
                { label: "Hub height", value: `${defaults.hubHeight} m` },
                { label: "Average wind speed", value: `${defaults.averageWindSpeed} m/s` },
                { label: "Capacity factor", value: `${defaults.capacityFactor}%` },
            );
            plan.notes.push("Wind planning keeps the site wind regime fixed and scales the fleet size to the self-sufficiency target.");
            break;
        }
        case "biomass": {
            plan.formValues.feedstock = defaults.feedstock;
            plan.formValues.availability = defaults.availability;
            plan.formValues.conversionEfficiency = defaults.conversionEfficiency;
            plan.formValues.operatingHours = defaults.operatingHours;
            plan.details.push(
                { label: "Feedstock", value: titleCase(defaults.feedstock) },
                { label: "Fuel availability", value: `${defaults.availability}%` },
                { label: "Conversion efficiency", value: `${defaults.conversionEfficiency}%` },
                { label: "Operating hours", value: `${formatPlannerNumber(toNumber(defaults.operatingHours) * scale)} h/yr` },
            );
            plan.notes.push("Biomass planning assumes the same conversion efficiency and scales annual runtime for the target energy output.");
            break;
        }
        case "geothermal": {
            plan.formValues.wellDepth = defaults.wellDepth;
            plan.formValues.reservoirTemperature = defaults.reservoirTemperature;
            plan.formValues.reinjectionRate = defaults.reinjectionRate;
            plan.formValues.plantType = defaults.plantType;
            plan.details.push(
                { label: "Well depth", value: `${defaults.wellDepth} m` },
                { label: "Source temperature", value: `${defaults.reservoirTemperature} C` },
                { label: "Reinjection rate", value: `${defaults.reinjectionRate}%` },
                { label: "Plant type", value: titleCase(defaults.plantType) },
            );
            plan.notes.push("Geothermal planning keeps the reservoir assumptions fixed and scales plant capacity against the required annual yield.");
            break;
        }
        case "hydropower": {
            const scaledFlowRate = toNumber(defaults.flowRate) * scale;
            plan.formValues.waterHead = defaults.waterHead;
            plan.formValues.flowRate = scaledFlowRate.toFixed(2);
            plan.formValues.turbineType = defaults.turbineType;
            plan.formValues.seasonalAvailability = defaults.seasonalAvailability;
            plan.details.push(
                { label: "Water head", value: `${defaults.waterHead} m` },
                { label: "Flow rate", value: `${formatPlannerNumber(scaledFlowRate, 2)} m3/s` },
                { label: "Turbine type", value: titleCase(defaults.turbineType) },
                { label: "Seasonal availability", value: `${defaults.seasonalAvailability}%` },
            );
            plan.notes.push("Hydropower planning uses the same head and turbine type while scaling flow throughput to hit the target output.");
            break;
        }
        default:
            break;
    }

    return plan;
}

function App() {
    const mapRef = useRef(null);
    const diagramExportRef = useRef(null);
    const [selectedType, setSelectedType] = useState(initialType);
    const [formState, setFormState] = useState(createFormState(initialType));
    const [resources, setResources] = useState([]);
    const [showMap, setShowMap] = useState(false);
    const [exportingFormat, setExportingFormat] = useState("");
    const [selfSufficiencyTarget, setSelfSufficiencyTarget] = useState(40);
    const [implementationBudget, setImplementationBudget] = useState("160000");
    const [plannerSource, setPlannerSource] = useState("pv");

    const selectedConfig = resourceTypeConfig[selectedType];
    const renewableGeneration = resources.reduce((total, resource) => total + resource.annualOutputMWh, 0);
    const gridImport = Math.max(BASE_DEMAND_MWH - renewableGeneration, 0);
    const amortizedCapex = resources.reduce(
        (total, resource) => total + resource.investmentCost * MONTHLY_CAPEX_FACTOR,
        0,
    );
    const avoidedGridCost = Math.min(BASE_DEMAND_MWH, renewableGeneration) * GRID_ENERGY_RATE;
    const totalCost = Math.max(BASE_COST_EUR - avoidedGridCost + amortizedCapex, 0);
    const renewableShare = BASE_DEMAND_MWH > 0
        ? Math.min((renewableGeneration / BASE_DEMAND_MWH) * 100, 100)
        : 0;
    const commercialDemandShare = 65.4;
    const residentialDemandShare = 100 - commercialDemandShare;

    const kpis = [
        { icon: "⚡", title: "Total Demand", value: formatEnergy(BASE_DEMAND_MWH), note: "Demand baseline for 30 days" },
        { icon: "⇄", title: "Grid Import", value: formatEnergy(gridImport), note: `${numberFormatter.format(100 - renewableShare)}% of demand supplied by grid` },
        { icon: "☼", title: "Renewable Generation", value: formatEnergy(renewableGeneration), note: `${resources.length} configured renewable assets` },
        { icon: "€", title: "Total Cost", value: formatCurrency(totalCost), note: "Operating cost plus monthly capex" },
    ];

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
            const totalOutput = resources
                .filter((resource) => resource.type === type)
                .reduce((total, resource) => total + resource.annualOutputMWh, 0);

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
    const commercialDemand = (BASE_DEMAND_MWH * commercialDemandShare) / 100;
    const residentialDemand = BASE_DEMAND_MWH - commercialDemand;
    const inverterThroughput = pvGeneration + windGeneration + hydropowerGeneration;
    const gridInterfaceLoad = gridImport;
    const thermalLoopOutput = geothermalGeneration + biomassGeneration;
    const selfSufficiencyOutputTarget = (BASE_DEMAND_MWH * selfSufficiencyTarget) / 100;
    const selectedPlannerConfig = resourceTypeConfig[plannerSource];
    const selfSufficiencyPlan = buildSelfSufficiencyPlan(plannerSource, selfSufficiencyOutputTarget);
    const implementationBudgetValue = toNumber(implementationBudget);
    const budgetDelta = implementationBudgetValue - toNumber(selfSufficiencyPlan.formValues.investmentCost);

    const renewableSourceTones = {
        pv: "solar",
        wind: "wind",
        battery: "battery",
        biomass: "biomass",
        geothermal: "geothermal",
        hydropower: "hydropower",
    };

    const renewableSourceNodes = typeBreakdown.map((item, index) => {
        const share = BASE_DEMAND_MWH > 0 ? (item.output / BASE_DEMAND_MWH) * 100 : 0;
        const sourceNodeStart = 170;
        const sourceNodeStep = 92;

        return {
            key: item.type,
            title: item.label,
            icon: item.icon,
            value: item.value,
            percent: formatPercent(share),
            note: `${numberFormatter.format(share)}% of demand`,
            tone: renewableSourceTones[item.type] || "solar",
            tooltip: item.resources.map((resource) => `${resource.name} • ${formatEnergy(resource.annualOutputMWh)}`),
            y: sourceNodeStart + (index * sourceNodeStep),
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
            y: 92,
        },
        ...renewableSourceNodes,
    ];

    const sourceLinkCoords = sourceNodes.map((node) => ({
        key: `${node.key}-to-hub`,
        className: `${node.tone}-to-hub`,
        amount: node.value,
        percent: node.percent,
        x1: 180,
        y1: node.y,
        x2: 430,
        y2: 390,
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
            label: "Thermal Loop",
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
            label: "Water Intake",
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

    function handleLoadPlanIntoForm() {
        setSelectedType(plannerSource);
        setFormState((currentState) => ({
            ...createFormState(plannerSource),
            ...currentState,
            ...selfSufficiencyPlan.formValues,
            type: plannerSource,
        }));
    }

    function handleTypeChange(type) {
        setSelectedType(type);
        setFormState(createFormState(type));
    }

    function handleFieldChange(event) {
        const { name, value } = event.target;
        setFormState((currentState) => ({
            ...currentState,
            [name]: value,
        }));
    }

    function handleSubmit(event) {
        event.preventDefault();

        const nextResource = {
            id: `${selectedType}-${Date.now()}`,
            type: selectedType,
            name: formState.name.trim() || `${selectedConfig.label} ${resources.length + 1}`,
            site: formState.site.trim() || "Unassigned site",
            status: formState.status,
            capacityKw: toNumber(formState.capacityKw),
            annualOutputMWh: toNumber(formState.annualOutputMWh),
            investmentCost: toNumber(formState.investmentCost),
            customFields: selectedConfig.fields.map((field) => ({
                label: field.label,
                value: formState[field.name] || "-",
                suffix: field.suffix || "",
            })),
        };

        setResources((currentResources) => [nextResource, ...currentResources]);
        setFormState(createFormState(selectedType));
    }

    function handleReset() {
        setFormState(createFormState(selectedType));
    }

    function handleRemove(resourceId) {
        setResources((currentResources) => currentResources.filter((resource) => resource.id !== resourceId));
    }

    function renderField(field) {
        if (field.type === "select") {
            return (
                <label className="form-field" key={field.name}>
                    <span>{field.label}</span>
                    <select name={field.name} value={formState[field.name]} onChange={handleFieldChange}>
                        {field.options.map((option) => (
                            <option key={option} value={option}>
                                {titleCase(option)}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        return (
            <label className="form-field" key={field.name}>
                <span>{field.label}</span>
                <div className="input-shell">
                    <input
                        name={field.name}
                        type={field.type}
                        value={formState[field.name]}
                        onChange={handleFieldChange}
                        placeholder={field.placeholder || ""}
                        min={field.type === "number" ? "0" : undefined}
                    />
                    {field.suffix ? <small>{field.suffix}</small> : null}
                </div>
            </label>
        );
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

            <section className="panel planner-panel">
                <div className="panel-head planner-head">
                    <div>
                        <h3>Self-Sufficiency Planner</h3>
                        <p>Choose a target self-sufficiency level, set an implementation budget, and see the exact renewable setup needed to reach it.</p>
                    </div>
                    <div className="planner-target-pill">{formatPercent(selfSufficiencyTarget)} target</div>
                </div>

                <div className="planner-grid">
                    <div className="planner-controls-card">
                        <label className="planner-field">
                            <span>Self sufficiency</span>
                            <strong>{formatPercent(selfSufficiencyTarget)}</strong>
                            <input
                                max="100"
                                min="0"
                                step="1"
                                type="range"
                                value={selfSufficiencyTarget}
                                onChange={(event) => setSelfSufficiencyTarget(toNumber(event.target.value))}
                            />
                            <small>Target renewable contribution for the 30-day demand baseline.</small>
                        </label>

                        <label className="planner-field">
                            <span>Initial cost of implementation</span>
                            <div className="planner-budget-input">
                                <small>EUR</small>
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={implementationBudget}
                                    onChange={(event) => setImplementationBudget(event.target.value)}
                                />
                            </div>
                            <small>Budget available to implement the recommended renewable route.</small>
                        </label>
                    </div>

                    <div className="planner-route-card">
                        <div className="planner-route-head">
                            <span className="flow-label">Possible self-sufficiency routes</span>
                            <strong>{formatEnergy(selfSufficiencyOutputTarget)} renewable output required</strong>
                        </div>
                        <div className="planner-route-grid">
                            {plannerEligibleTypes.map((type) => {
                                const config = resourceTypeConfig[type];
                                const plan = buildSelfSufficiencyPlan(type, selfSufficiencyOutputTarget);

                                return (
                                    <button
                                        type="button"
                                        className={`planner-route-option ${plannerSource === type ? "active" : ""}`}
                                        key={type}
                                        onClick={() => setPlannerSource(type)}
                                    >
                                        <span className="planner-route-icon">{config.icon}</span>
                                        <strong>{config.label}</strong>
                                        <small>{plan.details[2]?.value || currencyFormatter.format(0)}</small>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="planner-recommendation-card">
                        <div className="planner-recommendation-head">
                            <div>
                                <span className="flow-label">Recommended setup</span>
                                <h4>{selectedPlannerConfig.icon} {selectedPlannerConfig.label} route to {formatPercent(selfSufficiencyTarget)} self sufficiency</h4>
                            </div>
                            <button className="secondary-btn" type="button" onClick={handleLoadPlanIntoForm}>
                                Load into customization
                            </button>
                        </div>

                        <div className="planner-insight-grid">
                            {selfSufficiencyPlan.details.map((detail) => (
                                <div className="planner-insight" key={detail.label}>
                                    <span>{detail.label}</span>
                                    <strong>{detail.value}</strong>
                                </div>
                            ))}
                        </div>

                        <div className={`planner-budget-status ${budgetDelta >= 0 ? "within" : "gap"}`}>
                            <span>{budgetDelta >= 0 ? "Budget status" : "Budget gap"}</span>
                            <strong>
                                {budgetDelta >= 0
                                    ? `${currencyFormatter.format(budgetDelta)} available after implementation`
                                    : `${currencyFormatter.format(Math.abs(budgetDelta))} additional budget required`}
                            </strong>
                        </div>

                        <div className="planner-note-list">
                            {selfSufficiencyPlan.notes.map((note) => (
                                <p key={note}>{note}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="main-layout">
                <div className="control-board">
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
                                        y2="390"
                                    />
                                ))}
                                <line className="flow-line-svg commercial" x1="570" y1="372" x2="830" y2="182" />
                                <line className="flow-line-svg residential" x1="570" y1="410" x2="830" y2="612" />
                            </svg>

                            {sourceNodes.map((node) => (
                                <article className={`flow-node-card ${node.tone}`} key={node.key} style={{ left: "2.5%", top: `${(node.y / FLOW_DIAGRAM_HEIGHT) * 100}%`, transform: "translateY(-50%)" }}>
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
                                            <div className="flow-tooltip flow-tooltip-subnode" role="tooltip">
                                                <strong>{node.label}</strong>
                                                <div className="flow-tooltip-lines">
                                                    {node.tooltip.map((line) => (
                                                        <span key={line}>{line}</span>
                                                    ))}
                                                </div>
                                            </div>
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

                        <div className="pipeline-summary-chips">
                            <div className="chip">
                                <span>Primary source</span>
                                <strong>
                                    {renewableGeneration > 0
                                        ? `Renewables offset ${numberFormatter.format(renewableShare)}% of monthly demand.`
                                        : "Grid import currently covers full demand."}
                                </strong>
                            </div>
                            <div className="chip">
                                <span>Resource mix</span>
                                <strong>{resourceMix || "No renewable assets configured yet."}</strong>
                            </div>
                            <div className="chip chip-breakdown">
                                <span>Generation split</span>
                                <strong>
                                    {typeBreakdown.length > 0
                                        ? typeBreakdown.map((item) => `${item.label} ${item.value}`).join(" • ")
                                        : "No renewable generation available yet."}
                                </strong>
                            </div>
                            <div className="chip chip-breakdown">
                                <span>Other renewables</span>
                                <strong>{otherRenewableGeneration > 0 ? formatEnergy(otherRenewableGeneration) : "No battery or biomass output yet."}</strong>
                            </div>
                        </div>
                    </article>

                    <article className="panel resource-panel">
                        <div className="panel-head resource-panel-head">
                            <div>
                                <h3>Renewable Customization</h3>
                                <p>Choose a resource type, enter its parameters, and update the dashboard immediately.</p>
                            </div>
                            <div className="resource-count">{resources.length} assets</div>
                        </div>

                        <div className="resource-type-grid">
                            {Object.entries(resourceTypeConfig).map(([type, config]) => (
                                <button
                                    type="button"
                                    className={`resource-type-card ${selectedType === type ? "active" : ""}`}
                                    key={type}
                                    onClick={() => handleTypeChange(type)}
                                >
                                    <span className="resource-type-icon">{config.icon}</span>
                                    <strong>{config.label}</strong>
                                    <small>{config.description}</small>
                                </button>
                            ))}
                        </div>

                        <form className="resource-form" onSubmit={handleSubmit}>
                            <div className="resource-form-grid">
                                {commonFields.map(renderField)}
                                {selectedConfig.fields.map(renderField)}
                            </div>

                            <div className="resource-form-actions">
                                <button className="primary-btn" type="submit">
                                    Add {selectedConfig.label}
                                </button>
                                <button className="secondary-btn" type="button" onClick={handleReset}>
                                    Reset
                                </button>
                            </div>
                        </form>

                        <div className="resource-list">
                            <div className="resource-list-head">
                                <h4>Configured resources</h4>
                                <span>{resources.length > 0 ? `${resources.length} total` : "No assets added"}</span>
                            </div>

                            {resources.length === 0 ? (
                                <div className="resource-empty-state">
                                    Add a resource to test how renewable generation changes grid import and cost.
                                </div>
                            ) : (
                                resources.map((resource) => (
                                    <article className="resource-item" key={resource.id}>
                                        <div className="resource-item-top">
                                            <div>
                                                <div className="resource-badges">
                                                    <span className={`resource-pill ${resource.type}`}>{resourceTypeConfig[resource.type].label}</span>
                                                    <span className="resource-pill muted">{titleCase(resource.status)}</span>
                                                </div>
                                                <h4>{resource.name}</h4>
                                                <p>{resource.site}</p>
                                            </div>

                                            <button
                                                className="icon-btn"
                                                type="button"
                                                onClick={() => handleRemove(resource.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className="resource-metrics">
                                            <div>
                                                <span>Capacity</span>
                                                <strong>{numberFormatter.format(resource.capacityKw)} kW</strong>
                                            </div>
                                            <div>
                                                <span>Output</span>
                                                <strong>{formatEnergy(resource.annualOutputMWh)}</strong>
                                            </div>
                                            <div>
                                                <span>Investment</span>
                                                <strong>{formatCurrency(resource.investmentCost)}</strong>
                                            </div>
                                        </div>

                                        <div className="resource-detail-grid">
                                            {resource.customFields.slice(0, 4).map((field) => (
                                                <div className="resource-detail" key={field.label}>
                                                    <span>{field.label}</span>
                                                    <strong>{field.value}{field.suffix ? ` ${field.suffix}` : ""}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                ))
                            )}
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