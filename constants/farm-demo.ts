import { ImageSourcePropType } from "react-native";

export type ToneName = "forest" | "amber" | "teal" | "rose" | "slate";

export const dashboardHeroImage: ImageSourcePropType = require("@/assets_imported/images_imported/silkie-chicken-header.jpg");
export const profilesHeroImage: ImageSourcePropType = require("@/assets_imported/images_imported/rhode-island-red.jpg");

export const dashboardMetrics = [
    {
        label: "Active flock",
        value: "128",
        detail: "4 coops monitored",
        icon: "account-group-outline",
        tone: "forest" as const,
    },
    {
        label: "Health alerts",
        value: "03",
        detail: "1 urgent, 2 follow-up",
        icon: "alert-circle-outline",
        tone: "amber" as const,
    },
    {
        label: "Photo scans",
        value: "12",
        detail: "9 pending review",
        icon: "camera-outline",
        tone: "teal" as const,
    },
    {
        label: "Reports ready",
        value: "07",
        detail: "Week summary prepared",
        icon: "file-chart-outline",
        tone: "rose" as const,
    },
];

export const dashboardActions = [
    {
        title: "Capture chicken",
        description: "Breed and health scan",
        icon: "camera-plus-outline",
        tone: "teal" as const,
    },
    {
        title: "Open journal",
        description: "Log behavior notes",
        icon: "notebook-outline",
        tone: "forest" as const,
    },
    {
        title: "View schedule",
        description: "Feed and care plan",
        icon: "calendar-clock-outline",
        tone: "amber" as const,
    },
    {
        title: "Inventory",
        description: "Supplies and stock",
        icon: "warehouse-outline",
        tone: "rose" as const,
    },
];

export const dashboardActivity = [
    {
        title: "Breed recognition completed",
        detail: "Silkie hen scanned successfully",
        time: "2 min ago",
        icon: "check-decagram-outline",
        tone: "forest" as const,
    },
    {
        title: "Feed reminder scheduled",
        detail: "Morning feed set for Coop B",
        time: "15 min ago",
        icon: "bell-outline",
        tone: "amber" as const,
    },
    {
        title: "Health note added",
        detail: "Worker logged reduced activity",
        time: "Today, 07:40",
        icon: "note-text-outline",
        tone: "teal" as const,
    },
];

export const profileHighlights = [
    {
        label: "Breed",
        value: "Silkie",
        detail: "Photo-verified",
        icon: "feather",
        tone: "forest" as const,
    },
    {
        label: "Age",
        value: "11 weeks",
        detail: "Growing stage",
        icon: "calendar-month-outline",
        tone: "amber" as const,
    },
    {
        label: "Sex",
        value: "Female",
        detail: "Reference matched",
        icon: "gender-female",
        tone: "teal" as const,
    },
    {
        label: "Status",
        value: "Healthy",
        detail: "Routine monitoring",
        icon: "heart-outline",
        tone: "rose" as const,
    },
];

export const profileTimeline = [
    {
        title: "Morning feed completed",
        detail: "Grain intake recorded",
        time: "06:35",
        icon: "food-drumstick-outline",
        tone: "forest" as const,
    },
    {
        title: "Photo scan reviewed",
        detail: "Breed confirmed by worker",
        time: "08:16",
        icon: "image-search-outline",
        tone: "amber" as const,
    },
    {
        title: "Behavior note updated",
        detail: "Normal movement observed",
        time: "11:10",
        icon: "notebook-outline",
        tone: "teal" as const,
    },
];
