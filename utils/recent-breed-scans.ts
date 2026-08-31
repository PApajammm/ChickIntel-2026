import type { BreedScanAttributes } from "@/constants/breed-scan";
import { dashboardHeroImage } from "@/constants/farm-demo";
import { ensurePersistentImageUri } from "@/utils/persistent-image-storage";
import type { ImageSourcePropType } from "react-native";

export type BreedMetadata = {
  eggProduction: string;
  purpose: string;
  hardiness: string;
  temperament: string;
  weight: string;
  eggColor: string;
  triviaList: string[];
  careAdvice: string;
  healthWatch: string;
};

export type FeaturedBreedCard = {
  id: string;
  breedName: string;
  traits: string[];
  detail: string;
  image: ImageSourcePropType;
  tint: string;
  isDefault: boolean;
  capturedAt: number;
  eggProduction: string;
  purpose: string;
  hardiness: string;
  dailyTrivia: string;
  metadata?: BreedMetadata;
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

export const BREED_METADATA_MAP: Record<string, BreedMetadata> = {
  Silkie: {
    eggProduction: "100–120 / yr",
    purpose: "Ornamental & Brooder",
    hardiness: "Gentle / Dry Shelter",
    temperament: "Exceptionally gentle, docile & friendly",
    weight: "1.5 – 2.0 lbs (Bantam)",
    eggColor: "Cream / Tinted (Small)",
    triviaList: [
      "Silkie feathers lack barbicels, giving them a soft, fur-like down. They cannot fly!",
      "World-famous as patient foster mothers that will lovingly brood and hatch any clutch of eggs.",
      "Unique genetics: 5 toes per foot, black bones and skin, and striking turquoise earlobes.",
      "Keep coops dry and perches under 12 inches to protect their crests and feet.",
    ],
    careAdvice: "Silkies cannot fly and their down absorbs moisture quickly. Keep coops dry with low perches and sheltered runs.",
    healthWatch: "Prone to lice/mites hidden in dense head crests and sensitive to Marek's disease. Inspect facial feathers regularly.",
  },
  "Rhode Island Red": {
    eggProduction: "260–300 / yr",
    purpose: "Dual-Purpose (Meat & Eggs)",
    hardiness: "Extremely Cold Hardy",
    temperament: "Active, robust, independent & alert",
    weight: "6.5 – 8.5 lbs",
    eggColor: "Rich Brown (Large)",
    triviaList: [
      "One of the most celebrated dual-purpose production breeds in global poultry history.",
      "Can lay 5–6 large brown eggs every single week even during freezing winter months.",
      "Vigorous foragers with superb pest-hunting instincts that reduce supplemental feed costs.",
      "Official state bird of Rhode Island, bred for high flock vigor and natural disease resistance.",
    ],
    careAdvice: "Provide ample foraging space or outdoor pastures. They are active birds that thrive on free-range rotation.",
    healthWatch: "Roosters have prominent single combs vulnerable to frostbite in extreme cold. Check egg-laying consistency as hens age.",
  },
};

export function getDailyBreedTrivia(breedName: string): string {
  const meta = BREED_METADATA_MAP[breedName];
  if (!meta || !meta.triviaList.length) return "Hardy farm breed known for adaptable flock behavior.";
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const index = Math.abs(dayOfYear) % meta.triviaList.length;
  return meta.triviaList[index];
}

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
    eggProduction: BREED_METADATA_MAP.Silkie.eggProduction,
    purpose: BREED_METADATA_MAP.Silkie.purpose,
    hardiness: BREED_METADATA_MAP.Silkie.hardiness,
    dailyTrivia: getDailyBreedTrivia("Silkie"),
    metadata: BREED_METADATA_MAP.Silkie,
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
    eggProduction: BREED_METADATA_MAP["Rhode Island Red"].eggProduction,
    purpose: BREED_METADATA_MAP["Rhode Island Red"].purpose,
    hardiness: BREED_METADATA_MAP["Rhode Island Red"].hardiness,
    dailyTrivia: getDailyBreedTrivia("Rhode Island Red"),
    metadata: BREED_METADATA_MAP["Rhode Island Red"],
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
    return require("@/assets_imported/images_imported/silkie-chicken-header.jpg");
  }
  return dashboardHeroImage;
}

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

  const recentCards: FeaturedBreedCard[] = recentScans.map((scan) => {
    const meta = BREED_METADATA_MAP[scan.breedName];
    return {
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
      eggProduction: meta?.eggProduction ?? "180–220 / yr",
      purpose: meta?.purpose ?? "Heritage Farm Breed",
      hardiness: meta?.hardiness ?? "Moderate Climate",
      dailyTrivia: getDailyBreedTrivia(scan.breedName),
      metadata: meta,
    };
  });

  const seenBreeds = new Set(recentCards.map((card) => card.breedName));
  const defaultCards = DEFAULT_BREED_FEATURE_CARDS.filter(
    (card) => !seenBreeds.has(card.breedName),
  );
  return [...recentCards, ...defaultCards];
}
