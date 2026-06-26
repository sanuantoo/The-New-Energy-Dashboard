export const BASE_DEMAND_MWH = 45.19;
export const BASE_COST_EUR = 14292;
export const GRID_ENERGY_RATE = 210;
export const MONTHLY_CAPEX_FACTOR = 0.012;
export const DEFAULT_RENEWABLE_SHARE = 0.15;
export const DEFAULT_RENEWABLE_OUTPUT_MWH = BASE_DEMAND_MWH * DEFAULT_RENEWABLE_SHARE;
export const COMMERCIAL_DEMAND_SHARE = 65.4;

export const numberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

export const resourceTypeConfig = {
    pv: { label: "PV", icon: "☀" },
    wind: { label: "Wind", icon: "🌀" },
    battery: { label: "Battery", icon: "🔋" },
    biomass: { label: "Biomass", icon: "🌿" },
    geothermal: { label: "Geothermal", icon: "🌋" },
    hydropower: { label: "Hydropower", icon: "💧" },
};

export const defaultResources = [
    {
        id: "pv-default",
        type: "pv",
        name: "PV Supply",
        capacityKw: 52,
        annualOutputMWh: DEFAULT_RENEWABLE_OUTPUT_MWH,
        investmentCost: 65000,
    },
];

export function formatEnergy(value) {
    return `${numberFormatter.format(Math.max(value, 0))} MWh`;
}

export function formatEnergyKwh(value) {
    return `${numberFormatter.format(Math.max(value, 0) * 1000)} kWh`;
}

export function formatPowerKw(value) {
    return `${numberFormatter.format(Math.max(value, 0) * 1000)} kW`;
}

export function formatCurrency(value) {
    return currencyFormatter.format(Math.max(value, 0));
}

export function formatPercent(value) {
    return `${numberFormatter.format(Math.max(value, 0))}%`;
}

export function getDashboardSnapshot(resources = defaultResources) {
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
    const commercialDemandShare = COMMERCIAL_DEMAND_SHARE;
    const residentialDemandShare = 100 - commercialDemandShare;
    const commercialDemand = (BASE_DEMAND_MWH * commercialDemandShare) / 100;
    const residentialDemand = BASE_DEMAND_MWH - commercialDemand;
    const averageDailyDemand = BASE_DEMAND_MWH / 30;

    return {
        renewableGeneration,
        gridImport,
        amortizedCapex,
        avoidedGridCost,
        totalCost,
        renewableShare,
        commercialDemandShare,
        residentialDemandShare,
        commercialDemand,
        residentialDemand,
        averageDailyDemand,
    };
}

export function getDashboardKpis(resources = defaultResources) {
    const snapshot = getDashboardSnapshot(resources);

    return [
        { icon: "⚡", title: "Total Demand", value: formatEnergy(BASE_DEMAND_MWH), note: "Demand baseline for 30 days" },
        {
            icon: "⇄",
            title: "Grid Import",
            value: formatEnergy(snapshot.gridImport),
            note: `${numberFormatter.format(100 - snapshot.renewableShare)}% of demand supplied by grid`,
        },
        {
            icon: "☼",
            title: "Renewable Generation",
            value: formatEnergy(snapshot.renewableGeneration),
            note: `${numberFormatter.format(snapshot.renewableShare)}% of total demand supplied by renewables`,
        },
        { icon: "€", title: "Total Cost", value: formatCurrency(snapshot.totalCost), note: "Operating cost plus monthly capex" },
    ];
}

export function getChatbotMetricOptions(resources = defaultResources) {
    const snapshot = getDashboardSnapshot(resources);
    const componentDefinitions = {
        "Grid Import": "Grid Import shows the portion of electricity demand covered by power purchased from the external grid when on-site generation is not enough.",
        "Renewable Generation": "Renewable Generation measures the total electricity produced by on-site renewable assets during the current dashboard period.",
        "Total Cost": "Total Cost combines operating energy costs with amortized capital costs to show the overall monthly cost of the energy system.",
        "Capacity Factor": "Capacity Factor compares actual electricity produced with the maximum possible output over the same time window.",
        "Commercial Demand": "Commercial Demand represents the electricity consumed by commercial facilities connected to the energy system in the current reporting period.",
        "Residential Demand": "Residential Demand represents the electricity consumed by residential loads connected to the energy system in the current reporting period.",
        "Average Daily Demand": "Average Daily Demand is the mean amount of electricity used per day across the 30-day dashboard window.",
        "Energy Flow Diagram": "Energy Flow Diagram visualizes how electricity moves from grid and renewable sources through the energy system to connected demand loads.",
        "Supply vs Demand": "Supply vs Demand compares daily electricity demand with renewable supply and grid import across the current 30-day view.",
    };

    const kpis = getDashboardKpis(resources).map(({ title, value, note }) => ({
        label: title,
        value,
        description: note,
        definition: componentDefinitions[title] ?? note,
    }));

    return [
        ...kpis,
        {
            label: "Capacity Factor",
            value: "Calculator available",
            description: "Learn the formula and compute capacity factor from your inputs.",
            definition: componentDefinitions["Capacity Factor"],
        },
        {
            label: "Commercial Demand",
            value: formatEnergy(snapshot.commercialDemand),
            description: `${numberFormatter.format(snapshot.commercialDemandShare)}% of total demand.`,
            definition: componentDefinitions["Commercial Demand"],
        },
        {
            label: "Residential Demand",
            value: formatEnergy(snapshot.residentialDemand),
            description: `${numberFormatter.format(snapshot.residentialDemandShare)}% of total demand.`,
            definition: componentDefinitions["Residential Demand"],
        },
        {
            label: "Average Daily Demand",
            value: formatEnergy(snapshot.averageDailyDemand),
            description: "Average daily demand across the 30-day dashboard view.",
            definition: componentDefinitions["Average Daily Demand"],
        },
        {
            label: "Energy Flow Diagram",
            value: `${numberFormatter.format(snapshot.renewableShare)}% renewable share`,
            description: "Diagram of source-to-load energy movement.",
            definition: componentDefinitions["Energy Flow Diagram"],
            navigationTarget: "energy-flow-diagram",
        },
        {
            label: "Supply vs Demand",
            value: formatEnergy(snapshot.averageDailyDemand),
            description: "30-day demand and supply comparison chart.",
            definition: componentDefinitions["Supply vs Demand"],
            navigationTarget: "supply-vs-demand",
        },
    ];
}