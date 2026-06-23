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
    const kpis = getDashboardKpis(resources).map(({ title, value, note }) => ({
        label: title,
        value,
        description: note,
    }));

    return [
        ...kpis,
        {
            label: "Commercial Demand",
            value: formatEnergy(snapshot.commercialDemand),
            description: `${numberFormatter.format(snapshot.commercialDemandShare)}% of total demand.`,
        },
        {
            label: "Residential Demand",
            value: formatEnergy(snapshot.residentialDemand),
            description: `${numberFormatter.format(snapshot.residentialDemandShare)}% of total demand.`,
        },
        {
            label: "Average Daily Demand",
            value: formatEnergy(snapshot.averageDailyDemand),
            description: "Average daily demand across the 30-day dashboard view.",
        },
    ];
}