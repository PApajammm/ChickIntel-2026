import type { BreedScanAttributes } from "@/constants/breed-scan";
import { dashboardHeroImage } from "@/constants/farm-demo";
import type { ImageSourcePropType } from "react-native";

export type FeaturedBreedCard = {
  id: string;
  breedName: string;
  traits: string[];
  detail: string;
  image: ImageSourcePropType;
  tint: string;
  isDefault: boolean;
  capturedAt: number;
};

type RecentBreedScanInput = {
  breedName: string;
  traits?: string[];
  photoUri?: string;
  attributes?: BreedScanAttributes;
};

type RecentBreedScanEntry = {
  id: string;
  breedName: string;
  traits: string[];
  photoUri?: string;
  attributes?: BreedScanAttributes;
  capturedAt: number;
};

export type BreedLogEntry = RecentBreedScanEntry;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_RECENT_SCANS = 24;

const BREED_TRAIT_LIBRARY: Record<string, string[]> = {
  Leghorn: ["High egg production", "Active forager", "Heat tolerant"],
  Silkie: ["Gentle temperament", "Broody nature", "Cold sensitive"],
  "Rhode Island Red": ["Hardy breed", "Dual-purpose", "Consistent layer"],
};

const DEFAULT_BREED_FEATURE_CARDS: FeaturedBreedCard[] = [
  {
    id: "default-silkie",
    breedName: "Silkie",
    traits: BREED_TRAIT_LIBRARY.Silkie,
    detail: "Gentle temperament, broody nature",
    image: require("@/assets_imported/images_imported/silkie-chicken-header.jpg"),
    tint: "rgba(20, 42, 28, 0.18)",
    isDefault: true,
    capturedAt: 0,
  },
  {
    id: "default-rhode-island-red",
    breedName: "Rhode Island Red",
    traits: BREED_TRAIT_LIBRARY["Rhode Island Red"],
    detail: "Hardy breed, consistent layer",
    image: require("@/assets_imported/images_imported/rhode-island-red.jpg"),
    tint: "rgba(66, 99, 108, 0.18)",
    isDefault: true,
    capturedAt: 0,
  },
];

let recentScans: RecentBreedScanEntry[] = [];

function normalizeBreedName(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function getPopularTraits(breedName: string) {
  const fromLibrary = BREED_TRAIT_LIBRARY[breedName];
  if (fromLibrary && fromLibrary.length > 0) return fromLibrary;
  return ["Farm favorite", "Adaptable flock mate", "Good caretaker match"];
}

function pruneExpiredScans(now = Date.now()) {
  recentScans = recentScans.filter(
    (scan) => now - scan.capturedAt <= THREE_DAYS_MS,
  );
}

function fallbackImageForBreed(breedName: string): ImageSourcePropType {
  if (breedName === "Rhode Island Red") {
    return require("@/assets_imported/images_imported/rhode-island-red.jpg");
  }
  if (breedName === "Silkie") {
    return dashboardHeroImage;
  }
  return dashboardHeroImage;
}

import { ensurePersistentImageUri } from "@/utils/persistent-image-storage";

export function addRecentBreedScan(input: RecentBreedScanInput) {
  const breedName = normalizeBreedName(input.breedName);
  if (!breedName) return;

  pruneExpiredScans();

  const traits =
    input.traits && input.traits.length > 0
      ? input.traits
      : getPopularTraits(breedName);

  void ensurePersistentImageUri(input.photoUri).then((persistentUri) => {
    recentScans = recentScans.filter((scan) => scan.breedName !== breedName);
    recentScans.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      breedName,
      traits,
      photoUri: persistentUri || input.photoUri,
      attributes: input.attributes,
      capturedAt: Date.now(),
    });
    recentScans = recentScans.slice(0, MAX_RECENT_SCANS);
  });
}

export function getRecentBreedScans(): BreedLogEntry[] {
  pruneExpiredScans();
  return [...recentScans];
}

export function removeRecentBreedScans(ids: string[]) {
  const idSet = new Set(ids);
  recentScans = recentScans.filter((scan) => !idSet.has(scan.id));
}

export function getFeaturedBreedCards(now = Date.now()): FeaturedBreedCard[] {
  pruneExpiredScans(now);

  const recentCards: FeaturedBreedCard[] = recentScans.map((scan, index) => ({
    id: scan.id,
    breedName: scan.breedName,
    traits: scan.traits,
    detail: scan.traits.slice(0, 2).join(", "),
    image: scan.photoUri
      ? { uri: scan.photoUri }
      : fallbackImageForBreed(scan.breedName),
    tint: "rgba(18, 34, 24, 0.2)",
    isDefault: false,
    capturedAt: scan.capturedAt,
  }));

  const seenBreeds = new Set(recentCards.map((card) => card.breedName));
  const defaultCards = DEFAULT_BREED_FEATURE_CARDS.filter(
    (card) => !seenBreeds.has(card.breedName),
  );
  return [...recentCards, ...defaultCards];
}
