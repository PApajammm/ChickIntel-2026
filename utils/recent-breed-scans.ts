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
  Leghorn: {
    eggProduction: "280–320 / yr",
    purpose: "Egg Production Superstar",
    hardiness: "Heat Tolerant & Active",
    temperament: "Alert, flighty, energetic & prolific",
    weight: "4.5 – 6.0 lbs",
    eggColor: "Pristine Chalk White (Large)",
    triviaList: [
      "World's most prolific white egg layer, converting feed to eggs with incredible metabolic efficiency.",
      "Originated from the port city of Livorno in Tuscany, Italy, and popularized worldwide.",
      "Large floppy red single combs act as natural radiators to keep them cool in hot climates.",
      "Rarely go broody, dedicating virtually all their energy toward continuous laying.",
    ],
    careAdvice: "Ensure high-fenced enclosures or covered runs as Leghorns are agile flyers and active roost jumpers.",
    healthWatch: "High laying output requires consistent calcium and protein. Monitor for egg binding and feather picking.",
  },
  "Plymouth Rock": {
    eggProduction: "200–280 / yr",
    purpose: "Dual-Purpose Classic",
    hardiness: "Very Cold Hardy & Docile",
    temperament: "Calm, affectionate, friendly & sturdy",
    weight: "6.5 – 9.5 lbs",
    eggColor: "Light to Medium Brown (Large)",
    triviaList: [
      "The iconic American heritage breed recognized by its crisp black and white zebra-striped 'Barred' pattern.",
      "Known as one of the friendliest backyard flock birds, often enjoying being held by handlers.",
      "Developed in Massachusetts in the 19th century as the premier all-around homestead farm bird.",
      "Very winter-hardy with thick feathering that shields them from cold drafts and damp chills.",
    ],
    careAdvice: "Maintain clean dry bedding and broad flat roosting bars to support their heavy, muscular frames.",
    healthWatch: "Watch weight in mature hens as their calm demeanor can lead to obesity if fed high-calorie treats.",
  },
  Australorp: {
    eggProduction: "250–300 / yr",
    purpose: "Egg Production & Meat",
    hardiness: "All-Weather Resilient",
    temperament: "Sweet-tempered, quiet & gentle",
    weight: "6.5 – 8.5 lbs",
    eggColor: "Light Tinted Brown (Large)",
    triviaList: [
      "An Australorp hen holds the world record for laying an astounding 364 eggs in 365 days!",
      "Bred in Australia from Black Orpingtons to maximize egg yield in warm farm environments.",
      "Feathers shimmer with a mesmerizing beetle-green iridescence when sunlight hits them.",
      "Exceptionally quiet and peaceful, making them ideal for urban farms and mixed flock coops.",
    ],
    careAdvice: "Provide shade on blistering summer days. Their black plumage absorbs heat, though they handle warmth well.",
    healthWatch: "Inspect under wings and vent for external parasites that can easily hide in dark plumage.",
  },
  Turken: {
    eggProduction: "180–220 / yr",
    purpose: "Dual-Purpose & Meat",
    hardiness: "Heat & Cold Tolerant",
    temperament: "Curious, docile, friendly & tough",
    weight: "6.0 – 8.5 lbs",
    eggColor: "Light Brown (Medium to Large)",
    triviaList: [
      "Despite the name and appearance, Turkens are 100% chickens, not a turkey hybrid!",
      "A single dominant gene causes naturally featherless necks, meaning roughly 50% fewer feathers to pluck.",
      "Extremely heat-tolerant because exposed neck skin facilitates rapid body cooling.",
      "Surprisingly cold-hardy too; their dense body plumage keeps core body heat perfectly insulated.",
    ],
    careAdvice: "In sub-zero winters, protect exposed neck skin from severe icy windburn with windbreak coop walls.",
    healthWatch: "Check bare neck skin periodically for sunburn in open pastures with minimal natural tree shade.",
  },
  Bielefelder: {
    eggProduction: "230–280 / yr",
    purpose: "Dual-Purpose Heavy Heritage",
    hardiness: "Cold Hardy & Sturdy",
    temperament: "Gentle giant, calm & quiet",
    weight: "7.0 – 10.0 lbs",
    eggColor: "Jumbo Brown / Speckled (X-Large)",
    triviaList: [
      "Known as the 'Uber-Chicken' of Germany, bred in the 1970s for huge size, gentle nature, and big eggs.",
      "Naturally auto-sexing: day-old male and female chicks have distinctly different plumage patterns.",
      "Lays famously massive brown eggs with frequent terracotta speckling and thick shells.",
      "Very friendly giants that rarely squabble or show aggression toward other coop mates.",
    ],
    careAdvice: "Provide extra-wide doorways and strong perches set 12–18 inches high to accommodate their substantial weight.",
    healthWatch: "Because of their large heavy frame, monitor for bumblefoot if roosts have rough wood or sharp edges.",
  },
  "Black Orpington": {
    eggProduction: "190–240 / yr",
    purpose: "Dual-Purpose & Brooder",
    hardiness: "Winter Champion",
    temperament: "Placid, cuddly, slow & regal",
    weight: "7.0 – 10.0 lbs",
    eggColor: "Rich Tinted Brown (Large)",
    triviaList: [
      "Famous for dense, fluffy cloud-like feathering that makes them look twice their actual weight!",
      "Bred in Orpington, England, during the 'Hen Fever' era for superior winter egg production.",
      "Excellent winter layers because their luxurious down traps warmth like a thermal coat.",
      "Gentle lap-chickens that often bond closely with farmers and come running for feed.",
    ],
    careAdvice: "Keep bedding extra clean and dry because deep feathering drags near the ground and absorbs damp soil.",
    healthWatch: "Fluffy vent feathers can collect droppings; trim periodically to maintain cleanliness and fertility.",
  },
  Sussex: {
    eggProduction: "240–260 / yr",
    purpose: "Dual-Purpose Heritage",
    hardiness: "Cold Hardy & Adaptable",
    temperament: "Confident, curious, friendly & polite",
    weight: "6.0 – 8.0 lbs",
    eggColor: "Light Brown / Cream (Large)",
    triviaList: [
      "One of the oldest British breeds, prized since the Roman conquest of Britain over 2,000 years ago.",
      "Light Sussex feature striking snowy white bodies contrasted with crisp black-laced neck collars.",
      "Naturally curious foragers that love shadowing farmers around the yard looking for treats.",
      "Great winter layers that maintain steady production without being phased by chilly weather.",
    ],
    careAdvice: "Sussex love exploratory foraging; rotational grazing keeps them active and boosts yolk pigmentation.",
    healthWatch: "Generally robust and long-lived. Ensure adequate calcium to sustain their steady multi-year laying.",
  },
  "New Hampshire": {
    eggProduction: "200–240 / yr",
    purpose: "Dual-Purpose & Fast Grower",
    hardiness: "Cold Hardy & Vigorous",
    temperament: "Competitive, energetic & sturdy",
    weight: "6.5 – 8.5 lbs",
    eggColor: "Medium Brown (Large)",
    triviaList: [
      "Selected from Rhode Island Reds for lightning-fast feathering, rapid maturity, and heavy meat yield.",
      "Features a brilliant chestnut-red color with golden neck hackles that shimmer in sunlight.",
      "Known for robust vigor, strong immune systems, and early egg onset as young pullets.",
      "Great homestead choice that produces dependable family table meat and generous egg breakfasts.",
    ],
    careAdvice: "Allow generous outdoor roaming to channel their energetic foraging spirit and prevent coop boredom.",
    healthWatch: "Active and food-motivated; ensure adequate feeder space so all flock members eat peacefully.",
  },
  Fayoumi: {
    eggProduction: "150–200 / yr",
    purpose: "Egg Production & Forager",
    hardiness: "Extreme Heat Tolerant",
    temperament: "Wild, independent, fast & alert",
    weight: "3.5 – 4.5 lbs",
    eggColor: "Cream / Off-White (Small to Medium)",
    triviaList: [
      "An ancient Egyptian breed traced back to the time of the Pharaohs along the River Nile!",
      "Naturally resistant to most viral and bacterial poultry diseases that affect Western breeds.",
      "Maturing astonishingly early, pullets often start laying as early as 4–5 months old.",
      "World-class predator evasion skills: agile flyers, ultra-sharp eyesight, and lightning reflexes.",
    ],
    careAdvice: "Requires high fences and secure enclosures; Fayoumis are expert roost flyers and master escapists.",
    healthWatch: "Does exceptionally well in high heat and humidity. Needs warm dry shelter in cold, frosty winters.",
  },
  Buckeye: {
    eggProduction: "180–220 / yr",
    purpose: "Dual-Purpose & Mouser",
    hardiness: "Super Cold Hardy",
    temperament: "Affectionate, bold & fearless",
    weight: "6.5 – 9.0 lbs",
    eggColor: "Medium Brown (Large)",
    triviaList: [
      "The only standard poultry breed in America created entirely by a woman (Mrs. Nettie Metcalf in Ohio).",
      "Has small cushion pea combs that are practically immune to frostbite in Arctic winter temperatures.",
      "Legendary reputation as ferocious mousedown hunters, actively catching mice and pests around the barn!",
      "Features rich mahogany-bay plumage matching the dark color of the Ohio Buckeye tree seed.",
    ],
    careAdvice: "Provide outdoor yards or open pasture; their active hunting instincts keep coops naturally pest-free.",
    healthWatch: "Extremely resilient with virtually zero comb frostbite risk. Maintain balanced standard layer feeds.",
  },
};

export function getDailyBreedTrivia(breedName: string): string {
  const meta = BREED_METADATA_MAP[breedName];
  if (!meta || !meta.triviaList.length)
    return "Hardy farm breed known for adaptable flock behavior.";
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const index = Math.abs(dayOfYear) % meta.triviaList.length;
  return meta.triviaList[index];
}

export const BREED_TRAIT_LIBRARY: Record<string, string[]> = {
  Silkie: ["Gentle temperament", "Broody nature", "Unique down plumage"],
  "Rhode Island Red": ["Hardy breed", "Dual-purpose", "Consistent layer"],
  Leghorn: ["High egg production", "Active forager", "Heat tolerant"],
  "Plymouth Rock": ["Docile nature", "Dual-purpose classic", "Cold hardy"],
  Australorp: ["Record egg layer", "Sweet temperament", "All-weather hardy"],
  Turken: ["Featherless neck", "Extreme heat tolerant", "Curious & docile"],
  Bielefelder: ["Auto-sexing breed", "Jumbo brown eggs", "Gentle giant"],
  "Black Orpington": ["Fluffy winter coat", "Calm & cuddly", "Great brooder"],
  Sussex: ["Ancient heritage", "Curious forager", "Polite flock mate"],
  "New Hampshire": ["Fast feathering", "High flock vigor", "Early layer"],
  Fayoumi: ["Ancient Egyptian lineage", "Disease resistant", "Heat champion"],
  Buckeye: ["Pea comb frost proof", "Barn mouser instinct", "Mahogany plumage"],
};

function fallbackImageForBreed(breedName: string): ImageSourcePropType {
  const norm = breedName.toLowerCase();
  if (norm.includes("leghorn")) {
    return require("@/assets_imported/images_imported/leghorn.jpg");
  }
  if (norm.includes("australorp")) {
    return require("@/assets_imported/images_imported/australorp.jpg");
  }
  if (norm.includes("bielefelder")) {
    return require("@/assets_imported/images_imported/bielefelder.jpg");
  }
  if (norm.includes("orpington")) {
    return require("@/assets_imported/images_imported/black-orpington.jpg");
  }
  if (norm.includes("sussex")) {
    return require("@/assets_imported/images_imported/sussex.jpg");
  }
  if (norm.includes("new hampshire")) {
    return require("@/assets_imported/images_imported/new-hampshire.jpg");
  }
  if (norm.includes("fayoumi")) {
    return require("@/assets_imported/images_imported/fayoumi.jpg");
  }
  if (norm.includes("buckeye")) {
    return require("@/assets_imported/images_imported/buckeye.jpg");
  }
  if (norm.includes("silkie")) {
    return require("@/assets_imported/images_imported/silkie-chicken-header.jpg");
  }
  if (norm.includes("rhode island")) {
    return require("@/assets_imported/images_imported/rhode-island-red.jpg");
  }
  if (norm.includes("plymouth") || norm.includes("barred")) {
    return require("@/assets_imported/images_imported/barred-rock-chickens.jpg");
  }
  if (norm.includes("turken")) {
    return require("@/assets_imported/images_imported/bantam_rock.jpg");
  }
  return dashboardHeroImage;
}

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
  {
    id: "default-leghorn",
    breedName: "Leghorn",
    traits: BREED_TRAIT_LIBRARY.Leghorn,
    detail: "High egg production, heat tolerant",
    image: require("@/assets_imported/images_imported/leghorn.jpg"),
    tint: "rgba(49, 118, 103, 0.18)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP.Leghorn.eggProduction,
    purpose: BREED_METADATA_MAP.Leghorn.purpose,
    hardiness: BREED_METADATA_MAP.Leghorn.hardiness,
    dailyTrivia: getDailyBreedTrivia("Leghorn"),
    metadata: BREED_METADATA_MAP.Leghorn,
  },
  {
    id: "default-bielefelder",
    breedName: "Bielefelder",
    traits: BREED_TRAIT_LIBRARY.Bielefelder,
    detail: "Auto-sexing breed, jumbo brown eggs",
    image: require("@/assets_imported/images_imported/bielefelder.jpg"),
    tint: "rgba(49, 118, 103, 0.18)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP.Bielefelder.eggProduction,
    purpose: BREED_METADATA_MAP.Bielefelder.purpose,
    hardiness: BREED_METADATA_MAP.Bielefelder.hardiness,
    dailyTrivia: getDailyBreedTrivia("Bielefelder"),
    metadata: BREED_METADATA_MAP.Bielefelder,
  },
  {
    id: "default-black-orpington",
    breedName: "Black Orpington",
    traits: BREED_TRAIT_LIBRARY["Black Orpington"],
    detail: "Fluffy winter coat, calm & cuddly",
    image: require("@/assets_imported/images_imported/black-orpington.jpg"),
    tint: "rgba(18, 34, 24, 0.2)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP["Black Orpington"].eggProduction,
    purpose: BREED_METADATA_MAP["Black Orpington"].purpose,
    hardiness: BREED_METADATA_MAP["Black Orpington"].hardiness,
    dailyTrivia: getDailyBreedTrivia("Black Orpington"),
    metadata: BREED_METADATA_MAP["Black Orpington"],
  },
  {
    id: "default-sussex",
    breedName: "Sussex",
    traits: BREED_TRAIT_LIBRARY.Sussex,
    detail: "Ancient heritage, curious forager",
    image: require("@/assets_imported/images_imported/sussex.jpg"),
    tint: "rgba(49, 118, 103, 0.18)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP.Sussex.eggProduction,
    purpose: BREED_METADATA_MAP.Sussex.purpose,
    hardiness: BREED_METADATA_MAP.Sussex.hardiness,
    dailyTrivia: getDailyBreedTrivia("Sussex"),
    metadata: BREED_METADATA_MAP.Sussex,
  },
  {
    id: "default-new-hampshire",
    breedName: "New Hampshire",
    traits: BREED_TRAIT_LIBRARY["New Hampshire"],
    detail: "Fast feathering, high flock vigor",
    image: require("@/assets_imported/images_imported/new-hampshire.jpg"),
    tint: "rgba(66, 99, 108, 0.18)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP["New Hampshire"].eggProduction,
    purpose: BREED_METADATA_MAP["New Hampshire"].purpose,
    hardiness: BREED_METADATA_MAP["New Hampshire"].hardiness,
    dailyTrivia: getDailyBreedTrivia("New Hampshire"),
    metadata: BREED_METADATA_MAP["New Hampshire"],
  },
  {
    id: "default-fayoumi",
    breedName: "Fayoumi",
    traits: BREED_TRAIT_LIBRARY.Fayoumi,
    detail: "Ancient lineage, extreme heat champion",
    image: require("@/assets_imported/images_imported/fayoumi.jpg"),
    tint: "rgba(35, 62, 54, 0.18)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP.Fayoumi.eggProduction,
    purpose: BREED_METADATA_MAP.Fayoumi.purpose,
    hardiness: BREED_METADATA_MAP.Fayoumi.hardiness,
    dailyTrivia: getDailyBreedTrivia("Fayoumi"),
    metadata: BREED_METADATA_MAP.Fayoumi,
  },
  {
    id: "default-buckeye",
    breedName: "Buckeye",
    traits: BREED_TRAIT_LIBRARY.Buckeye,
    detail: "Pea comb frost proof, barn mouser",
    image: require("@/assets_imported/images_imported/buckeye.jpg"),
    tint: "rgba(66, 99, 108, 0.18)",
    isDefault: true,
    capturedAt: 0,
    eggProduction: BREED_METADATA_MAP.Buckeye.eggProduction,
    purpose: BREED_METADATA_MAP.Buckeye.purpose,
    hardiness: BREED_METADATA_MAP.Buckeye.hardiness,
    dailyTrivia: getDailyBreedTrivia("Buckeye"),
    metadata: BREED_METADATA_MAP.Buckeye,
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
