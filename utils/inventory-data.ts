export type InventoryItem = {
    id: string;
    type: string;
    name: string;
    qty: number;
    unit: string;
    statusPercent: number;
    orderDate: Date;
    deliveryDate?: Date;
};

export const MOCK_INVENTORY: InventoryItem[] = [
    {
        id: "1",
        type: "Feeds",
        name: "(sample brand)",
        qty: 50,
        unit: "kg",
        statusPercent: 60,
        orderDate: new Date("2026-03-10"),
        deliveryDate: new Date("2026-03-15"),
    },
    {
        id: "2",
        type: "Vitamins",
        name: "(sample brand)",
        qty: 1,
        unit: "box",
        statusPercent: 15,
        orderDate: new Date("2026-03-20"),
    },
    {
        id: "3",
        type: "Medicine",
        name: "(sample brand)",
        qty: 6,
        unit: "pcs",
        statusPercent: 85,
        orderDate: new Date("2026-02-15"),
        deliveryDate: new Date("2026-02-20"),
    },
    {
        id: "4",
        type: "Equipment",
        name: "feeder",
        qty: 20,
        unit: "pcs",
        statusPercent: 40,
        orderDate: new Date("2026-01-30"),
        deliveryDate: new Date("2026-02-05"),
    },
];

export function getInventoryItems(): InventoryItem[] {
    return MOCK_INVENTORY;
}

export function getFeedsTotal(): number {
    return MOCK_INVENTORY.filter((i) => i.type === "Feeds").reduce(
        (sum, it) => sum + (it.qty || 0),
        0,
    );
}
