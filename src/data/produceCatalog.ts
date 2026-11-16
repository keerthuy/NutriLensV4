/**
 * Produce Catalog (Vegetables & Fruits) with per-100g nutritional profiles.
 * 
 * Nutritional values derived from USDA FoodData Central & Open Food Facts.
 * Thresholds aligned with FSA, ADA, AHA/DASH, and KDIGO/NKF clinical guidelines.
 * Refer to docs/nutrilens_health_rules_references.md for complete references.
 */

import { HealthCondition, Allergen } from '../services/nutrilens_health_rules';

export type GlycemicIndex = 'low' | 'medium' | 'high';

export interface ProduceItem {
  id: string;
  name: string;
  category: 'vegetable' | 'fruit';
  emoji: string;
  sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
  phosphorus_mg: number;
  fiber_g: number;
  saturatedFat_g: number;
  glycemicIndex: GlycemicIndex;
  allergens: Allergen[];
}

/**
 * Centralized Threshold Configuration for Produce Suitability.
 * Can be tuned ±20% for research One-At-A-Time (OAT) sensitivity analysis.
 */
export const PRODUCE_THRESHOLDS = {
  // UK FSA Front-of-Pack & ADA Standards of Care (Diabetes)
  // Low sugar: <= 5g/100g, Low GI: <= 55, Min fiber: >= 2g
  diabetes: {
    maxSugar_g: 5.0,
    minFiber_g: 2.0,
    allowedGI: ['low'] as const,
  },

  // AHA / ACC & DASH Diet Guidelines (Hypertension)
  // Low sodium produce: <= 70mg/100g, High potassium: >= 250mg/100g
  high_blood_pressure: {
    maxSodium_mg: 70,
    minPotassium_mg: 250,
  },

  // KDIGO & NKF KDOQI Clinical Guidelines (Chronic Kidney Disease)
  // Low potassium: <= 200mg/100g, Low phosphorus: <= 50mg/100g, Sodium: <= 70mg/100g
  kidney_disease: {
    maxPotassium_mg: 200,
    maxPhosphorus_mg: 50,
    maxSodium_mg: 70,
  },

  // AHA & ESC Cardiovascular Guidelines (Heart Disease)
  // Low sat fat: <= 0.5g/100g, Min fiber: >= 2g/100g, Sodium: <= 80mg/100g
  heart_disease: {
    maxSatFat_g: 0.5,
    minFiber_g: 2.0,
    maxSodium_mg: 80,
  },

  // ESC Dyslipidemia & AHA Guidelines (High Cholesterol)
  // Low sat fat: <= 0.5g/100g, High fiber: >= 2g/100g
  high_cholesterol: {
    maxSatFat_g: 0.5,
    minFiber_g: 2.0,
  },

  // General healthy baseline (no diagnosed medical conditions)
  general: {
    maxSugar_g: 10.0,
    minFiber_g: 1.5,
    maxSatFat_g: 1.0,
    maxSodium_mg: 100,
  },
};

export interface ConditionEvaluation {
  isSuitable: boolean;
  score: number; // 0 - 100
  reason: string;
  caution?: string;
}

/**
 * Pure evaluation function deriving condition suitability from nutrient thresholds.
 * Handles the explicit conflict between Kidney Disease and High Blood Pressure.
 */
export const evaluateProduceConditionSuitability = (
  item: ProduceItem,
  condition: HealthCondition,
  allMemberConditions: HealthCondition[] = [],
  thresholds = PRODUCE_THRESHOLDS
): ConditionEvaluation => {
  const hasKidneyDisease = allMemberConditions.includes('kidney_disease');

  switch (condition) {
    case 'diabetes': {
      const cfg = thresholds.diabetes;
      const isLowGI = (cfg.allowedGI as readonly string[]).includes(item.glycemicIndex);
      const isLowSugar = item.sugar_g <= cfg.maxSugar_g;
      const hasFiber = item.fiber_g >= cfg.minFiber_g;

      if (isLowGI && isLowSugar) {
        let score = 85;
        if (hasFiber) score += 15;
        return {
          isSuitable: true,
          score: Math.min(100, score),
          reason: `Low in sugar (${item.sugar_g}g/100g) and low GI with ${item.fiber_g}g fiber for stable blood sugar.`,
        };
      }

      if (item.glycemicIndex === 'high' || item.sugar_g > cfg.maxSugar_g * 1.5) {
        return {
          isSuitable: false,
          score: 25,
          reason: `Higher sugar (${item.sugar_g}g) and ${item.glycemicIndex} GI.`,
          caution: 'May elevate blood glucose; monitor portions.',
        };
      }

      return {
        isSuitable: false,
        score: 50,
        reason: `Moderate sugar content (${item.sugar_g}g/100g).`,
        caution: 'Consume in controlled portions.',
      };
    }

    case 'high_blood_pressure': {
      const cfg = thresholds.high_blood_pressure;
      const isLowSodium = item.sodium_mg <= cfg.maxSodium_mg;

      // EXPLICIT CONFLICT RESOLUTION:
      // If the member has BOTH kidney disease and high blood pressure,
      // renal low-potassium constraint strictly overrides HBP potassium intake!
      if (hasKidneyDisease) {
        const isRenalSafeK = item.potassium_mg <= thresholds.kidney_disease.maxPotassium_mg;
        if (isLowSodium && isRenalSafeK) {
          return {
            isSuitable: true,
            score: 90,
            reason: `Low sodium (${item.sodium_mg}mg) and renal-safe potassium (${item.potassium_mg}mg) for blood pressure & kidney safety.`,
          };
        }
        return {
          isSuitable: false,
          score: 30,
          reason: `High potassium (${item.potassium_mg}mg) is unsafe with concurrent kidney disease.`,
          caution: 'Potassium restricted due to kidney disease.',
        };
      }

      const isHighPotassium = item.potassium_mg >= cfg.minPotassium_mg;
      if (isLowSodium && isHighPotassium) {
        return {
          isSuitable: true,
          score: 95,
          reason: `Rich in potassium (${item.potassium_mg}mg) and low in sodium to support healthy blood pressure.`,
        };
      }

      if (isLowSodium) {
        return {
          isSuitable: true,
          score: 75,
          reason: `Low in sodium (${item.sodium_mg}mg/100g), heart and arterial friendly.`,
        };
      }

      return {
        isSuitable: false,
        score: 40,
        reason: `Elevated sodium content (${item.sodium_mg}mg/100g).`,
        caution: 'Moderate sodium; limit portion.',
      };
    }

    case 'kidney_disease': {
      const cfg = thresholds.kidney_disease;
      const isLowPotassium = item.potassium_mg <= cfg.maxPotassium_mg;
      const isLowPhosphorus = item.phosphorus_mg <= cfg.maxPhosphorus_mg;
      const isLowSodium = item.sodium_mg <= cfg.maxSodium_mg;

      if (isLowPotassium && isLowPhosphorus && isLowSodium) {
        return {
          isSuitable: true,
          score: 95,
          reason: `Low in potassium (${item.potassium_mg}mg) and phosphorus (${item.phosphorus_mg}mg), gentle on kidneys.`,
        };
      }

      if (!isLowPotassium) {
        return {
          isSuitable: false,
          score: 20,
          reason: `High potassium (${item.potassium_mg}mg/100g) exceeds renal tolerance (${cfg.maxPotassium_mg}mg).`,
          caution: 'High potassium; avoid or strictly limit in renal diets.',
        };
      }

      return {
        isSuitable: false,
        score: 35,
        reason: `Phosphorus (${item.phosphorus_mg}mg) or sodium (${item.sodium_mg}mg) above renal limit.`,
        caution: 'Consult renal dietitian before consuming.',
      };
    }

    case 'heart_disease': {
      const cfg = thresholds.heart_disease;
      const isLowSatFat = item.saturatedFat_g <= cfg.maxSatFat_g;
      const isGoodFiber = item.fiber_g >= cfg.minFiber_g;
      const isLowSodium = item.sodium_mg <= cfg.maxSodium_mg;

      if (isLowSatFat && isGoodFiber && isLowSodium) {
        return {
          isSuitable: true,
          score: 95,
          reason: `High dietary fiber (${item.fiber_g}g) and virtually zero saturated fat, promoting cardiovascular health.`,
        };
      }

      if (isLowSatFat && isLowSodium) {
        return {
          isSuitable: true,
          score: 80,
          reason: `Low saturated fat and low sodium to protect heart vessels.`,
        };
      }

      return {
        isSuitable: false,
        score: 45,
        reason: 'Sub-optimal fiber or elevated sodium for cardiovascular support.',
        caution: 'Consume in moderation.',
      };
    }

    case 'high_cholesterol': {
      const cfg = thresholds.high_cholesterol;
      const isLowSatFat = item.saturatedFat_g <= cfg.maxSatFat_g;
      const isHighFiber = item.fiber_g >= cfg.minFiber_g;

      if (isLowSatFat && isHighFiber) {
        return {
          isSuitable: true,
          score: 95,
          reason: `Rich in soluble fiber (${item.fiber_g}g) to bind and clear LDL cholesterol.`,
        };
      }

      if (isLowSatFat) {
        return {
          isSuitable: true,
          score: 75,
          reason: `Zero cholesterol and low saturated fat (${item.saturatedFat_g}g/100g).`,
        };
      }

      return {
        isSuitable: false,
        score: 40,
        reason: `Higher saturated fat (${item.saturatedFat_g}g) or low fiber.`,
        caution: 'Limit portions to protect lipid levels.',
      };
    }

    default:
      return {
        isSuitable: true,
        score: 80,
        reason: 'Nutrient-rich whole produce.',
      };
  }
};

/**
 * ~30 Vegetable Items with realistic per-100g nutrient profiles
 */
export const VEGETABLE_CATALOG: ProduceItem[] = [
  {
    id: 'veg_broccoli',
    name: 'Broccoli',
    category: 'vegetable',
    emoji: '🥦',
    sugar_g: 1.7,
    sodium_mg: 33,
    potassium_mg: 316,
    phosphorus_mg: 66,
    fiber_g: 2.6,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_spinach',
    name: 'Spinach',
    category: 'vegetable',
    emoji: '🥬',
    sugar_g: 0.4,
    sodium_mg: 79,
    potassium_mg: 558, // High potassium! Great for HBP, restricted for Kidney
    phosphorus_mg: 49,
    fiber_g: 2.2,
    saturatedFat_g: 0.06,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_carrot',
    name: 'Carrot',
    category: 'vegetable',
    emoji: '🥕',
    sugar_g: 4.7,
    sodium_mg: 69,
    potassium_mg: 320,
    phosphorus_mg: 35,
    fiber_g: 2.8,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_cauliflower',
    name: 'Cauliflower',
    category: 'vegetable',
    emoji: '🤍',
    sugar_g: 1.9,
    sodium_mg: 30,
    potassium_mg: 299,
    phosphorus_mg: 44,
    fiber_g: 2.0,
    saturatedFat_g: 0.05,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_cucumber',
    name: 'Cucumber',
    category: 'vegetable',
    emoji: '🥒',
    sugar_g: 1.7,
    sodium_mg: 2,
    potassium_mg: 147, // Low potassium! Ideal for Kidney Disease
    phosphorus_mg: 24,
    fiber_g: 0.5,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_zucchini',
    name: 'Zucchini',
    category: 'vegetable',
    emoji: '🥒',
    sugar_g: 2.5,
    sodium_mg: 8,
    potassium_mg: 261,
    phosphorus_mg: 38,
    fiber_g: 1.0,
    saturatedFat_g: 0.05,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_bell_pepper_green',
    name: 'Green Bell Pepper',
    category: 'vegetable',
    emoji: '🫑',
    sugar_g: 2.4,
    sodium_mg: 3,
    potassium_mg: 175, // Renal friendly (< 200mg)
    phosphorus_mg: 20,
    fiber_g: 1.7,
    saturatedFat_g: 0.06,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_bell_pepper_red',
    name: 'Red Bell Pepper',
    category: 'vegetable',
    emoji: '🫑',
    sugar_g: 4.2,
    sodium_mg: 4,
    potassium_mg: 211,
    phosphorus_mg: 26,
    fiber_g: 2.1,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_cabbage_green',
    name: 'Green Cabbage',
    category: 'vegetable',
    emoji: '🥬',
    sugar_g: 3.2,
    sodium_mg: 18,
    potassium_mg: 170, // Renal friendly
    phosphorus_mg: 26,
    fiber_g: 2.5,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_cabbage_red',
    name: 'Red Cabbage',
    category: 'vegetable',
    emoji: '🟣',
    sugar_g: 3.8,
    sodium_mg: 27,
    potassium_mg: 243,
    phosphorus_mg: 30,
    fiber_g: 2.1,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_asparagus',
    name: 'Asparagus',
    category: 'vegetable',
    emoji: '🎋',
    sugar_g: 1.9,
    sodium_mg: 2,
    potassium_mg: 202,
    phosphorus_mg: 52,
    fiber_g: 2.1,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_green_beans',
    name: 'Green Beans',
    category: 'vegetable',
    emoji: '🫘',
    sugar_g: 3.3,
    sodium_mg: 6,
    potassium_mg: 211,
    phosphorus_mg: 38,
    fiber_g: 2.7,
    saturatedFat_g: 0.05,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_celery',
    name: 'Celery',
    category: 'vegetable',
    emoji: '🌿',
    sugar_g: 1.3,
    sodium_mg: 80,
    potassium_mg: 260,
    phosphorus_mg: 24,
    fiber_g: 1.6,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_kale',
    name: 'Kale',
    category: 'vegetable',
    emoji: '🥬',
    sugar_g: 1.0,
    sodium_mg: 38,
    potassium_mg: 447, // High potassium
    phosphorus_mg: 56,
    fiber_g: 3.6,
    saturatedFat_g: 0.09,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_eggplant',
    name: 'Eggplant',
    category: 'vegetable',
    emoji: '🍆',
    sugar_g: 3.5,
    sodium_mg: 2,
    potassium_mg: 229,
    phosphorus_mg: 24,
    fiber_g: 3.0,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_tomato',
    name: 'Tomato',
    category: 'vegetable',
    emoji: '🍅',
    sugar_g: 2.6,
    sodium_mg: 5,
    potassium_mg: 237,
    phosphorus_mg: 24,
    fiber_g: 1.2,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_radish',
    name: 'Radish',
    category: 'vegetable',
    emoji: '⚪',
    sugar_g: 1.9,
    sodium_mg: 39,
    potassium_mg: 233,
    phosphorus_mg: 20,
    fiber_g: 1.6,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_lettuce_romaine',
    name: 'Romaine Lettuce',
    category: 'vegetable',
    emoji: '🥗',
    sugar_g: 1.2,
    sodium_mg: 8,
    potassium_mg: 247,
    phosphorus_mg: 30,
    fiber_g: 2.1,
    saturatedFat_g: 0.05,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_lettuce_iceberg',
    name: 'Iceberg Lettuce',
    category: 'vegetable',
    emoji: '🥬',
    sugar_g: 2.0,
    sodium_mg: 10,
    potassium_mg: 141, // Renal friendly
    phosphorus_mg: 20,
    fiber_g: 1.2,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_mushroom',
    name: 'White Mushroom',
    category: 'vegetable',
    emoji: '🍄',
    sugar_g: 2.0,
    sodium_mg: 5,
    potassium_mg: 318,
    phosphorus_mg: 86,
    fiber_g: 1.0,
    saturatedFat_g: 0.05,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_onion_yellow',
    name: 'Yellow Onion',
    category: 'vegetable',
    emoji: '🧅',
    sugar_g: 4.2,
    sodium_mg: 4,
    potassium_mg: 146, // Renal friendly
    phosphorus_mg: 29,
    fiber_g: 1.7,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_garlic',
    name: 'Garlic',
    category: 'vegetable',
    emoji: '🧄',
    sugar_g: 1.0,
    sodium_mg: 17,
    potassium_mg: 401,
    phosphorus_mg: 153,
    fiber_g: 2.1,
    saturatedFat_g: 0.09,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_beetroot',
    name: 'Beetroot',
    category: 'vegetable',
    emoji: '🟣',
    sugar_g: 6.8, // Medium sugar
    sodium_mg: 78,
    potassium_mg: 325,
    phosphorus_mg: 40,
    fiber_g: 2.8,
    saturatedFat_g: 0.03,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'veg_sweet_potato',
    name: 'Sweet Potato',
    category: 'vegetable',
    emoji: '🍠',
    sugar_g: 4.2,
    sodium_mg: 55,
    potassium_mg: 337, // High potassium
    phosphorus_mg: 47,
    fiber_g: 3.0,
    saturatedFat_g: 0.02,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'veg_potato',
    name: 'Potato (Boiled)',
    category: 'vegetable',
    emoji: '🥔',
    sugar_g: 0.6,
    sodium_mg: 6,
    potassium_mg: 379, // High potassium, high GI
    phosphorus_mg: 57,
    fiber_g: 1.8,
    saturatedFat_g: 0.03,
    glycemicIndex: 'high',
    allergens: [],
  },
  {
    id: 'veg_brussels_sprouts',
    name: 'Brussels Sprouts',
    category: 'vegetable',
    emoji: '🥬',
    sugar_g: 2.2,
    sodium_mg: 25,
    potassium_mg: 389,
    phosphorus_mg: 69,
    fiber_g: 3.8,
    saturatedFat_g: 0.07,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_okra',
    name: 'Okra',
    category: 'vegetable',
    emoji: '🌿',
    sugar_g: 1.5,
    sodium_mg: 7,
    potassium_mg: 299,
    phosphorus_mg: 61,
    fiber_g: 3.2,
    saturatedFat_g: 0.05,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_artichoke',
    name: 'Artichoke',
    category: 'vegetable',
    emoji: '🌱',
    sugar_g: 1.0,
    sodium_mg: 94,
    potassium_mg: 370,
    phosphorus_mg: 90,
    fiber_g: 5.4, // Exceptional fiber
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_leek',
    name: 'Leek',
    category: 'vegetable',
    emoji: '🌱',
    sugar_g: 3.9,
    sodium_mg: 20,
    potassium_mg: 180, // Renal friendly
    phosphorus_mg: 35,
    fiber_g: 1.8,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_turnip',
    name: 'Turnip',
    category: 'vegetable',
    emoji: '⚪',
    sugar_g: 3.8,
    sodium_mg: 67,
    potassium_mg: 191, // Renal friendly (< 200mg)
    phosphorus_mg: 27,
    fiber_g: 1.8,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'veg_bok_choy',
    name: 'Bok Choy',
    category: 'vegetable',
    emoji: '🥬',
    sugar_g: 1.2,
    sodium_mg: 65,
    potassium_mg: 252,
    phosphorus_mg: 37,
    fiber_g: 1.0,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
];

/**
 * ~26 Fruit Items with realistic per-100g nutrient profiles
 */
export const FRUIT_CATALOG: ProduceItem[] = [
  {
    id: 'fruit_apple_gala',
    name: 'Gala Apple',
    category: 'fruit',
    emoji: '🍎',
    sugar_g: 10.4,
    sodium_mg: 1,
    potassium_mg: 107, // Renal friendly (< 200mg)
    phosphorus_mg: 11,
    fiber_g: 2.4,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_strawberry',
    name: 'Strawberry',
    category: 'fruit',
    emoji: '🍓',
    sugar_g: 4.9, // Low sugar!
    sodium_mg: 1,
    potassium_mg: 153, // Renal friendly
    phosphorus_mg: 24,
    fiber_g: 2.0,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_blueberry',
    name: 'Blueberry',
    category: 'fruit',
    emoji: '🫐',
    sugar_g: 9.9,
    sodium_mg: 1,
    potassium_mg: 77, // Very low potassium & phosphorus
    phosphorus_mg: 12,
    fiber_g: 2.4,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_raspberry',
    name: 'Raspberry',
    category: 'fruit',
    emoji: '🍇',
    sugar_g: 4.4, // Very low sugar, stellar fiber!
    sodium_mg: 1,
    potassium_mg: 151, // Renal friendly
    phosphorus_mg: 29,
    fiber_g: 6.5,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_blackberry',
    name: 'Blackberry',
    category: 'fruit',
    emoji: '🫐',
    sugar_g: 4.9,
    sodium_mg: 1,
    potassium_mg: 162, // Renal friendly
    phosphorus_mg: 22,
    fiber_g: 5.3,
    saturatedFat_g: 0.01,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_avocado',
    name: 'Avocado',
    category: 'fruit',
    emoji: '🥑',
    sugar_g: 0.7,
    sodium_mg: 7,
    potassium_mg: 485, // Very high potassium! Unsafe for Kidney Disease
    phosphorus_mg: 52,
    fiber_g: 6.7,
    saturatedFat_g: 2.13,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_banana',
    name: 'Banana',
    category: 'fruit',
    emoji: '🍌',
    sugar_g: 12.2, // High sugar & high potassium
    sodium_mg: 1,
    potassium_mg: 358,
    phosphorus_mg: 22,
    fiber_g: 2.6,
    saturatedFat_g: 0.11,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'fruit_orange',
    name: 'Orange',
    category: 'fruit',
    emoji: '🍊',
    sugar_g: 9.4,
    sodium_mg: 0,
    potassium_mg: 181,
    phosphorus_mg: 14,
    fiber_g: 2.4,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_grapefruit',
    name: 'Grapefruit',
    category: 'fruit',
    emoji: '🍊',
    sugar_g: 7.0,
    sodium_mg: 0,
    potassium_mg: 135,
    phosphorus_mg: 18,
    fiber_g: 1.6,
    saturatedFat_g: 0.01,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_pear',
    name: 'Pear',
    category: 'fruit',
    emoji: '🍐',
    sugar_g: 9.8,
    sodium_mg: 1,
    potassium_mg: 116, // Renal friendly
    phosphorus_mg: 12,
    fiber_g: 3.1,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_peach',
    name: 'Peach',
    category: 'fruit',
    emoji: '🍑',
    sugar_g: 8.4,
    sodium_mg: 0,
    potassium_mg: 190, // Renal friendly
    phosphorus_mg: 20,
    fiber_g: 1.5,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_plum',
    name: 'Plum',
    category: 'fruit',
    emoji: '🟣',
    sugar_g: 9.9,
    sodium_mg: 0,
    potassium_mg: 157, // Renal friendly
    phosphorus_mg: 16,
    fiber_g: 1.4,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_cherry',
    name: 'Sweet Cherry',
    category: 'fruit',
    emoji: '🍒',
    sugar_g: 12.8,
    sodium_mg: 0,
    potassium_mg: 222,
    phosphorus_mg: 21,
    fiber_g: 2.1,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_watermelon',
    name: 'Watermelon',
    category: 'fruit',
    emoji: '🍉',
    sugar_g: 6.2,
    sodium_mg: 1,
    potassium_mg: 112,
    phosphorus_mg: 11,
    fiber_g: 0.4,
    saturatedFat_g: 0.02,
    glycemicIndex: 'high', // High GI
    allergens: [],
  },
  {
    id: 'fruit_cantaloupe',
    name: 'Cantaloupe',
    category: 'fruit',
    emoji: '🍈',
    sugar_g: 7.9,
    sodium_mg: 16,
    potassium_mg: 267, // Elevated potassium
    phosphorus_mg: 15,
    fiber_g: 0.9,
    saturatedFat_g: 0.05,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'fruit_kiwi',
    name: 'Kiwi',
    category: 'fruit',
    emoji: '🥝',
    sugar_g: 9.0,
    sodium_mg: 3,
    potassium_mg: 312, // High potassium
    phosphorus_mg: 34,
    fiber_g: 3.0,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_lemon',
    name: 'Lemon',
    category: 'fruit',
    emoji: '🍋',
    sugar_g: 2.5, // Low sugar
    sodium_mg: 2,
    potassium_mg: 138,
    phosphorus_mg: 16,
    fiber_g: 2.8,
    saturatedFat_g: 0.04,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_lime',
    name: 'Lime',
    category: 'fruit',
    emoji: '🟢',
    sugar_g: 1.7, // Low sugar
    sodium_mg: 2,
    potassium_mg: 102,
    phosphorus_mg: 18,
    fiber_g: 2.8,
    saturatedFat_g: 0.02,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_grapes_red',
    name: 'Red Grapes',
    category: 'fruit',
    emoji: '🍇',
    sugar_g: 15.5, // High sugar
    sodium_mg: 2,
    potassium_mg: 191,
    phosphorus_mg: 20,
    fiber_g: 0.9,
    saturatedFat_g: 0.05,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'fruit_pineapple',
    name: 'Pineapple',
    category: 'fruit',
    emoji: '🍍',
    sugar_g: 9.9,
    sodium_mg: 1,
    potassium_mg: 109, // Low potassium, low phosphorus
    phosphorus_mg: 8,
    fiber_g: 1.4,
    saturatedFat_g: 0.01,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'fruit_mango',
    name: 'Mango',
    category: 'fruit',
    emoji: '🥭',
    sugar_g: 13.7, // High sugar
    sodium_mg: 1,
    potassium_mg: 168,
    phosphorus_mg: 14,
    fiber_g: 1.6,
    saturatedFat_g: 0.09,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'fruit_papaya',
    name: 'Papaya',
    category: 'fruit',
    emoji: '🍈',
    sugar_g: 7.8,
    sodium_mg: 8,
    potassium_mg: 182, // Renal friendly
    phosphorus_mg: 10,
    fiber_g: 1.7,
    saturatedFat_g: 0.04,
    glycemicIndex: 'medium',
    allergens: [],
  },
  {
    id: 'fruit_cranberries',
    name: 'Raw Cranberries',
    category: 'fruit',
    emoji: '🍒',
    sugar_g: 4.0, // Low sugar
    sodium_mg: 2,
    potassium_mg: 85, // Very low potassium & phosphorus
    phosphorus_mg: 13,
    fiber_g: 4.6,
    saturatedFat_g: 0.01,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_pomegranate',
    name: 'Pomegranate Seeds',
    category: 'fruit',
    emoji: '🍎',
    sugar_g: 13.7,
    sodium_mg: 3,
    potassium_mg: 236,
    phosphorus_mg: 36,
    fiber_g: 4.0,
    saturatedFat_g: 0.17,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_apricot',
    name: 'Apricot',
    category: 'fruit',
    emoji: '🍑',
    sugar_g: 9.2,
    sodium_mg: 1,
    potassium_mg: 259,
    phosphorus_mg: 23,
    fiber_g: 2.0,
    saturatedFat_g: 0.03,
    glycemicIndex: 'low',
    allergens: [],
  },
  {
    id: 'fruit_guava',
    name: 'Guava',
    category: 'fruit',
    emoji: '🍐',
    sugar_g: 8.9,
    sodium_mg: 2,
    potassium_mg: 417, // High potassium
    phosphorus_mg: 40,
    fiber_g: 5.4,
    saturatedFat_g: 0.27,
    glycemicIndex: 'low',
    allergens: [],
  },
];

