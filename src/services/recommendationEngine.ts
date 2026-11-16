/**
 * NutriLens Recommendation Engine
 * 
 * Pure, deterministic TypeScript recommendation engine.
 * Fully offline-capable; no runtime LLM or API calls.
 * 
 * Supports:
 * - 5 health conditions: diabetes, high blood pressure, heart disease, kidney disease, high cholesterol
 * - 10 allergens: dairy, egg, tree nuts, fish, gluten, wheat, sesame, seafood, peanuts, soy
 * - Strict allergen hard filtering
 * - Multi-condition intersection with clinical conflict hierarchy (Kidney overrides HBP potassium)
 * - Empty pool fallback ("suitable for most" with caution tags)
 * - Daily date-based seeded rotation
 * - Product-relevant emoji & contextual iconography for packaged goods
 */

import { HealthCondition, Allergen, evaluateFoodSafety } from './nutrilens_health_rules';
import {
  ProduceItem,
  VEGETABLE_CATALOG,
  FRUIT_CATALOG,
  evaluateProduceConditionSuitability,
  PRODUCE_THRESHOLDS,
  GlycemicIndex,
} from '../data/produceCatalog';

export interface RecommendedItem {
  id: string;
  name: string;
  category: 'vegetable' | 'fruit' | 'packed_food';
  imageKey?: string;
  emoji?: string;
  reasons: string[];
  cautions: string[];
  suitabilityScore: number; // 0 - 100
  conditionsSatisfied: HealthCondition[];
  nutrients?: {
    sugar_g?: number;
    sodium_mg?: number;
    potassium_mg?: number;
    phosphorus_mg?: number;
    fiber_g?: number;
    saturatedFat_g?: number;
    cholesterol_mg?: number;
  };
  glycemicIndex?: GlycemicIndex;
  ingredientsSnippet?: string;
}

export interface RecommendationEngineInput {
  conditions: HealthCondition[];
  allergens: Allergen[];
  seed?: number;
  limit?: number;
  packedFoodCandidates?: CandidatePackedFood[];
}

export interface RecommendationEngineOutput {
  vegetables: RecommendedItem[];
  fruits: RecommendedItem[];
  packedFoods: RecommendedItem[];
}

export interface CandidatePackedFood {
  id: string | number;
  product_name: string;
  ingredients_en?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
  additives_tags?: string[];
  sodium_100g?: number | null;
  sugars_100g?: number | null;
  sat_fat_100g?: number | null;
  cholesterol_100g?: number | null;
  potassium_100g?: number | null;
}

/**
 * Deterministic PRNG using Mulberry32.
 * Generates uniform random numbers [0, 1) based on a 32-bit integer seed.
 */
export const createSeededRandom = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Computes a deterministic integer seed based on YYYYMMDD date format.
 * Ensures: same member + same day = identical rotation picks.
 */
export const getDateSeed = (date: Date = new Date()): number => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
};

/**
 * Deterministic Fisher-Yates array shuffle using a seeded generator.
 */
export const seededShuffle = <T>(array: T[], seed: number): T[] => {
  const rng = createSeededRandom(seed);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * Checks if a candidate produce item contains ANY of the member's allergens.
 * Hard safety filter: allergens are never relaxed.
 */
export const hasProduceAllergenConflict = (
  item: ProduceItem,
  memberAllergens: Allergen[]
): boolean => {
  if (!memberAllergens || memberAllergens.length === 0) return false;
  return item.allergens.some(a => memberAllergens.includes(a));
};

/**
 * Returns a contextual, product-relevant food emoji for packaged goods
 * based on product title and ingredients keywords.
 */
export const getPackedFoodEmoji = (name: string = '', ingredients: string = ''): string => {
  const text = (name + ' ' + ingredients).toLowerCase();

  // Beverages & Juices
  if (text.includes('juice') || text.includes('cider') || text.includes('smoothie')) return '🧃';
  if (text.includes('tea') || text.includes('matcha') || text.includes('chai')) return '🍵';
  if (text.includes('coffee') || text.includes('espresso') || text.includes('caffeine')) return '☕';
  if (text.includes('water') || text.includes('sparkling') || text.includes('seltzer') || text.includes('soda')) return '🥤';

  // Dairy, Plant Milk & Yogurts
  if (text.includes('cheese') || text.includes('ricotta') || text.includes('cheddar') || text.includes('mozzarella')) return '🧀';
  if (text.includes('yogurt') || text.includes('yoghurt') || text.includes('curd')) return '🍧';
  if (text.includes('milk') || text.includes('kefir') || text.includes('dairy')) return '🥛';

  // Breakfast Cereals, Grains & Bakery
  if (text.includes('oat') || text.includes('cereal') || text.includes('granola') || text.includes('porridge') || text.includes('muesli')) return '🥣';
  if (text.includes('bread') || text.includes('toast') || text.includes('bagel') || text.includes('pita') || text.includes('bun')) return '🍞';
  if (text.includes('pasta') || text.includes('noodle') || text.includes('spaghetti') || text.includes('macaroni') || text.includes('penne')) return '🍝';
  if (text.includes('rice') || text.includes('quinoa') || text.includes('couscous')) return '🍚';

  // Soups, Meals & Legumes
  if (text.includes('soup') || text.includes('broth') || text.includes('stew') || text.includes('ramen')) return '🍲';
  if (text.includes('bean') || text.includes('lentil') || text.includes('chickpea') || text.includes('hummus')) return '🫘';
  if (text.includes('salad')) return '🥗';

  // Proteins
  if (text.includes('tuna') || text.includes('salmon') || text.includes('sardine') || text.includes('fish') || text.includes('cod')) return '🐟';
  if (text.includes('shrimp') || text.includes('prawn') || text.includes('crab')) return '🦐';
  if (text.includes('chicken') || text.includes('turkey') || text.includes('poultry')) return '🍗';
  if (text.includes('meat') || text.includes('beef') || text.includes('pork')) return '🥩';
  if (text.includes('tofu') || text.includes('tempeh')) return '🧊';
  if (text.includes('egg') || text.includes('omelet')) return '🥚';

  // Snacks & Treats
  if (text.includes('cracker') || text.includes('biscuit') || text.includes('wafer') || text.includes('cookie')) return '🍘';
  if (text.includes('popcorn') || text.includes('chip') || text.includes('crisp') || text.includes('pretzel')) return '🍿';
  if (text.includes('nut') || text.includes('almond') || text.includes('walnut') || text.includes('cashew') || text.includes('seed')) return '🥜';
  if (text.includes('bar') || text.includes('protein bar') || text.includes('energy bar')) return '🍫';
  if (text.includes('chocolate') || text.includes('cacao') || text.includes('cocoa')) return '🍫';

  // Condiments, Oils & Canned
  if (text.includes('oil') || text.includes('olive')) return '🫒';
  if (text.includes('sauce') || text.includes('vinegar') || text.includes('dressing') || text.includes('ketchup') || text.includes('mustard')) return '🍶';
  if (text.includes('can') || text.includes('canned') || text.includes('paste') || text.includes('puree')) return '🥫';
  if (text.includes('fruit') || text.includes('berry') || text.includes('apple')) return '🍎';

  return '🍱'; // Clean bento/packaged meal indicator
};

/**
 * Evaluates produce item for a member with NO medical conditions.
 * Uses general whole-food healthiness baseline (fiber density, low sugar, low sodium).
 */
const evaluateGeneralProduceSuitability = (item: ProduceItem): RecommendedItem => {
  const fiberScore = Math.min(30, item.fiber_g * 6);
  const sugarPenalty = Math.max(0, (item.sugar_g - 5) * 2);
  const sodiumPenalty = Math.max(0, (item.sodium_mg - 40) * 0.2);
  const baseScore = 75 + fiberScore - sugarPenalty - sodiumPenalty;
  const suitabilityScore = Math.max(50, Math.min(100, Math.round(baseScore)));

  const reasons: string[] = [
    `Wholesome ${item.category} rich in natural nutrients and ${item.fiber_g}g dietary fiber.`,
  ];
  if (item.sugar_g <= 5) {
    reasons.push(`Naturally low in sugar (${item.sugar_g}g/100g).`);
  }

  const cautions: string[] = [];
  if (item.sugar_g > 12) {
    cautions.push('Higher natural sugars; enjoy as part of a balanced diet.');
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    emoji: item.emoji,
    reasons,
    cautions,
    suitabilityScore,
    conditionsSatisfied: [],
    nutrients: {
      sugar_g: item.sugar_g,
      sodium_mg: item.sodium_mg,
      potassium_mg: item.potassium_mg,
      phosphorus_mg: item.phosphorus_mg,
      fiber_g: item.fiber_g,
      saturatedFat_g: item.saturatedFat_g,
    },
    glycemicIndex: item.glycemicIndex,
  };
};

/**
 * Evaluates a produce item against multiple member conditions.
 */
const evaluateProduceItemForConditions = (
  item: ProduceItem,
  conditions: HealthCondition[]
): {
  reasons: string[];
  cautions: string[];
  conditionsSatisfied: HealthCondition[];
  conditionsFailed: HealthCondition[];
  avgScore: number;
} => {
  const reasons: string[] = [];
  const cautions: string[] = [];
  const conditionsSatisfied: HealthCondition[] = [];
  const conditionsFailed: HealthCondition[] = [];
  let totalScore = 0;

  conditions.forEach(cond => {
    const evalResult = evaluateProduceConditionSuitability(item, cond, conditions);
    totalScore += evalResult.score;

    if (evalResult.isSuitable) {
      conditionsSatisfied.push(cond);
      reasons.push(evalResult.reason);
    } else {
      conditionsFailed.push(cond);
      if (evalResult.caution) {
        cautions.push(evalResult.caution);
      }
    }
  });

  const avgScore = conditions.length > 0 ? Math.round(totalScore / conditions.length) : 80;

  return {
    reasons,
    cautions,
    conditionsSatisfied,
    conditionsFailed,
    avgScore,
  };
};

/**
 * Recommends produce (vegetables or fruits) for given conditions and allergens.
 */
export const recommendProduceList = (
  catalog: ProduceItem[],
  conditions: HealthCondition[],
  allergens: Allergen[],
  seed: number = 0,
  limit: number = 6
): RecommendedItem[] => {
  // 1. HARD FILTER: Allergen safety
  const safeFromAllergens = catalog.filter(
    item => !hasProduceAllergenConflict(item, allergens)
  );

  // 2. Member with NO conditions -> General recommendations
  if (!conditions || conditions.length === 0) {
    const generalList = safeFromAllergens.map(evaluateGeneralProduceSuitability);
    generalList.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    const shuffled = seededShuffle(generalList, seed);
    return shuffled.slice(0, limit);
  }

  // 3. Evaluate each item against member conditions
  interface EvaluatedProduce {
    item: ProduceItem;
    reasons: string[];
    cautions: string[];
    conditionsSatisfied: HealthCondition[];
    conditionsFailed: HealthCondition[];
    score: number;
  }

  const evaluated: EvaluatedProduce[] = safeFromAllergens.map(item => {
    const res = evaluateProduceItemForConditions(item, conditions);
    return {
      item,
      reasons: res.reasons,
      cautions: res.cautions,
      conditionsSatisfied: res.conditionsSatisfied,
      conditionsFailed: res.conditionsFailed,
      score: res.avgScore,
    };
  });

  // Strict intersection: satisfies ALL member conditions
  const fullyQualifying = evaluated.filter(
    e => e.conditionsSatisfied.length === conditions.length
  );

  let pool: EvaluatedProduce[] = [];

  if (fullyQualifying.length > 0) {
    // Top-tier pool: all conditions satisfied
    pool = fullyQualifying;
  } else {
    // 4. FALLBACK RELAXATION: When no item satisfies all conditions
    // Pick items satisfying the maximum number of conditions ("suitable for most")
    const maxSatisfied = Math.max(...evaluated.map(e => e.conditionsSatisfied.length), 0);
    const relaxed = evaluated
      .filter(e => e.conditionsSatisfied.length === maxSatisfied && e.conditionsSatisfied.length > 0)
      .map(e => ({
        ...e,
        cautions: [
          `Suitable for most conditions; monitor portion for ${e.conditionsFailed.join(', ').replace(/_/g, ' ')}.`,
          ...e.cautions,
        ],
      }));

    pool = relaxed.length > 0 ? relaxed : evaluated;
  }

  // Map to RecommendedItem
  const recommended: RecommendedItem[] = pool.map(e => ({
    id: e.item.id,
    name: e.item.name,
    category: e.item.category,
    emoji: e.item.emoji,
    reasons: e.reasons.length > 0 ? e.reasons : ['Nutrient-dense produce.'],
    cautions: e.cautions,
    suitabilityScore: e.score,
    conditionsSatisfied: e.conditionsSatisfied,
    nutrients: {
      sugar_g: e.item.sugar_g,
      sodium_mg: e.item.sodium_mg,
      potassium_mg: e.item.potassium_mg,
      phosphorus_mg: e.item.phosphorus_mg,
      fiber_g: e.item.fiber_g,
      saturatedFat_g: e.item.saturatedFat_g,
    },
    glycemicIndex: e.item.glycemicIndex,
  }));

  // Sort by suitability score descending, then shuffle top tier deterministically by seed
  recommended.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  const shuffled = seededShuffle(recommended, seed);
  return shuffled.slice(0, limit);
};

/**
 * Normalizes Open Food Facts product names (handles JSON language strings if present).
 */
export const cleanProductName = (rawName: string | undefined): string => {
  if (!rawName) return 'Packaged Food Product';
  const trimmed = rawName.trim();
  if (trimmed.startsWith('[{') && trimmed.includes("'text':")) {
    try {
      const match = trimmed.match(/'text':\s*([^}]+)}/);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // fallback
    }
  }
  return trimmed;
};

/**
 * Recommends packaged foods from candidate SQLite records.
 * Uses existing evaluateFoodSafety engine to verify 'SAFE' verdict and allergen safety.
 */
export const recommendPackedFoods = (
  candidates: CandidatePackedFood[],
  conditions: HealthCondition[],
  allergens: Allergen[],
  seed: number = 0,
  limit: number = 6
): RecommendedItem[] => {
  if (!candidates || candidates.length === 0) return [];

  const qualified: RecommendedItem[] = [];

  for (const product of candidates) {
    const rawAllergenTags = product.allergens_tags || [];
    const rawTraceTags = product.traces_tags || [];

    // HARD ALLERGEN FILTER (both explicit tags and traces)
    let hasAllergenViolation = false;
    for (const userAllergen of allergens) {
      const term = userAllergen.toLowerCase();
      if (
        rawAllergenTags.some(t => t.toLowerCase().includes(term)) ||
        rawTraceTags.some(t => t.toLowerCase().includes(term))
      ) {
        hasAllergenViolation = true;
        break;
      }
    }
    if (hasAllergenViolation) continue;

    // Convert candidate record to DetectedFoodData for existing evaluateFoodSafety
    const detectedIngredients = product.ingredients_en
      ? product.ingredients_en.split(/[,;.]+/).map(s => s.trim()).filter(Boolean)
      : [];

    const sodium_mg = product.sodium_100g !== null && product.sodium_100g !== undefined
      ? Math.round(product.sodium_100g * 1000) // g to mg
      : undefined;

    const foodData = {
      productName: cleanProductName(product.product_name),
      detectedIngredients,
      detectedAllergenTags: rawAllergenTags,
      nutritionFacts: {
        sugar_g: product.sugars_100g !== null && product.sugars_100g !== undefined ? product.sugars_100g : undefined,
        sodium_mg,
        saturatedFat_g: product.sat_fat_100g !== null && product.sat_fat_100g !== undefined ? product.sat_fat_100g : undefined,
        unit: 'per100g' as const,
      },
    };

    const healthProfile = {
      userId: 'recommendation_eval',
      allergies: allergens,
      medicalConditions: conditions,
      dietaryRestrictions: [],
      ageGroup: 'adult' as const,
    };

    const evaluation = evaluateFoodSafety(foodData, healthProfile);

    // Strictly recommend products with 'SAFE' verdict and zero allergen flags
    if (evaluation.overallVerdict === 'SAFE' && evaluation.matchedAllergens.length === 0) {
      // Calculate suitability score (100 - riskScore)
      const suitabilityScore = Math.max(70, Math.min(100, 100 - evaluation.riskScore));

      const reasons: string[] = [];
      if (conditions.length > 0) {
        conditions.forEach(cond => {
          reasons.push(`Safe & approved for ${cond.replace(/_/g, ' ')}.`);
        });
      } else {
        reasons.push(evaluation.summary || 'Nutritionally safe packaged food.');
      }

      if (product.sugars_100g !== null && product.sugars_100g !== undefined && product.sugars_100g <= 5) {
        reasons.push(`Low sugar (${product.sugars_100g}g/100g).`);
      }
      if (sodium_mg !== undefined && sodium_mg <= 120) {
        reasons.push(`Low sodium (${sodium_mg}mg/100g).`);
      }

      // Assign product-relevant dynamic food emoji based on name & ingredients
      const contextualEmoji = getPackedFoodEmoji(product.product_name, product.ingredients_en);

      qualified.push({
        id: `packed_${product.id}`,
        name: cleanProductName(product.product_name),
        category: 'packed_food',
        emoji: contextualEmoji,
        reasons,
        cautions: [],
        suitabilityScore,
        conditionsSatisfied: [...conditions],
        ingredientsSnippet: product.ingredients_en ? product.ingredients_en.slice(0, 150) : undefined,
        nutrients: {
          sugar_g: product.sugars_100g ?? undefined,
          sodium_mg,
          saturatedFat_g: product.sat_fat_100g ?? undefined,
          cholesterol_mg: product.cholesterol_100g !== null && product.cholesterol_100g !== undefined
            ? Math.round(product.cholesterol_100g * 1000)
            : undefined,
          potassium_mg: product.potassium_100g !== null && product.potassium_100g !== undefined
            ? Math.round(product.potassium_100g * 1000)
            : undefined,
        },
      });
    }
  }

  // Sort by suitability score, then seeded shuffle within top tier
  qualified.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  const shuffled = seededShuffle(qualified, seed);
  return shuffled.slice(0, limit);
};

/**
 * Main pure entry point for Recommendation Engine.
 */
export const getRecommendations = (
  input: RecommendationEngineInput
): RecommendationEngineOutput => {
  const { conditions = [], allergens = [], seed = getDateSeed(), limit = 6, packedFoodCandidates = [] } = input;

  const vegetables = recommendProduceList(VEGETABLE_CATALOG, conditions, allergens, seed, limit);
  const fruits = recommendProduceList(FRUIT_CATALOG, conditions, allergens, seed + 1, limit);
  const packedFoods = recommendPackedFoods(packedFoodCandidates, conditions, allergens, seed + 2, limit);

  return {
    vegetables,
    fruits,
    packedFoods,
  };
};
