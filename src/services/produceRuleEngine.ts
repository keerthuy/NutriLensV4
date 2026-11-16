/**
 * NutriLens Produce Rule Engine
 * 
 * Standalone, deterministic rule engine for the 47 vegetables, fruits,
 * nuts, and produce items detected by the custom trained TFLite model.
 * 
 * Provides:
 * - 47 supported model classes with USDA/clinical nutritional benchmarks
 * - Clinically realistic default serving weights (e.g. 1 medium apple = 182g)
 * - Portion-scaled nutrient calculation (Sugar, Sodium, Potassium, Phosphorus, Fiber, Saturated Fat, Cholesterol)
 * - Deterministic multi-condition evaluation (Diabetes, HBP, Kidney Disease, Heart Disease, Cholesterol)
 * - Renal potassium constraint hierarchy (Kidney disease overrules HBP potassium)
 * - Hard allergen filtering (e.g. Almond -> tree_nuts, Egg -> egg)
 * - Plain-language clinical verdicts ("SAFE" | "CAUTION" | "AVOID") with actionable reasons
 */

export type ProduceHealthCondition =
  | 'diabetes'
  | 'high_blood_pressure'
  | 'heart_disease'
  | 'kidney_disease'
  | 'high_cholesterol';

export type ProduceAllergen =
  | 'dairy'
  | 'egg'
  | 'tree_nuts'
  | 'fish'
  | 'gluten'
  | 'wheat'
  | 'sesame'
  | 'seafood'
  | 'peanuts'
  | 'soy';

export type ProduceCategory = 'fruit' | 'vegetable' | 'nut' | 'legume' | 'protein';
export type GlycemicIndex = 'low' | 'medium' | 'high';
export type ProduceVerdict = 'SAFE' | 'CAUTION' | 'AVOID';

export interface ProduceModelItem {
  id: string;
  modelLabel: string;
  displayName: string;
  category: ProduceCategory;
  emoji: string;
  defaultWeight_g: number;
  servingDescription: string;
  // Per 100g nutritional profile
  per100g: {
    sugar_g: number;
    sodium_mg: number;
    potassium_mg: number;
    phosphorus_mg: number;
    fiber_g: number;
    saturatedFat_g: number;
    cholesterol_mg: number;
    glycemicIndex: GlycemicIndex;
    allergens: ProduceAllergen[];
  };
}

export interface ScaledNutrients {
  weight_g: number;
  sugar_g: number;
  sodium_mg: number;
  potassium_mg: number;
  phosphorus_mg: number;
  fiber_g: number;
  saturatedFat_g: number;
  cholesterol_mg: number;
  glycemicIndex: GlycemicIndex;
}

export interface ConditionRuleResult {
  condition: ProduceHealthCondition;
  verdict: ProduceVerdict;
  score: number; // 0 - 100
  reason: string;
  caution?: string;
}

export interface ProduceEvaluationResult {
  item: ProduceModelItem;
  servingWeight_g: number;
  servingDescription: string;
  verdict: ProduceVerdict;
  suitabilityScore: number; // 0 - 100
  headline: string;
  primaryReason: string;
  allReasons: string[];
  cautions: string[];
  allergensTriggered: ProduceAllergen[];
  conditionEvaluations: ConditionRuleResult[];
  scaledNutrients: ScaledNutrients;
  consumedNutrientHighlights: {
    label: string;
    value: string;
    status: 'good' | 'moderate' | 'high';
  }[];
}

/**
 * Exact list of 47 classes recognized by the trained TFLite model.
 */
export const SUPPORTED_PRODUCE_CLASSES: readonly string[] = [
  'almond',
  'apple',
  'asparagus',
  'avocado',
  'banana',
  'beans',
  'beet',
  'bell pepper',
  'blackberry',
  'blueberry',
  'broccoli',
  'brussels sprouts',
  'cabbage',
  'carrot',
  'cauliflower',
  'celery',
  'cherry',
  'corn',
  'cucumber',
  'egg',
  'eggplant',
  'garlic',
  'grape',
  'green bean',
  'green onion',
  'hot pepper',
  'kiwi',
  'lemon',
  'lettuce',
  'lime',
  'mandarin',
  'mushroom',
  'onion',
  'orange',
  'pattypan squash',
  'pea',
  'peach',
  'pear',
  'pineapple',
  'potato',
  'pumpkin',
  'radish',
  'raspberry',
  'strawberry',
  'tomato',
  'vegetable marrow',
  'watermelon',
] as const;

/**
 * 47 Produce items with USDA nutritional metrics and standard serving weights.
 */
export const PRODUCE_MODEL_CATALOG: Record<string, ProduceModelItem> = {
  almond: {
    id: 'prod_almond',
    modelLabel: 'almond',
    displayName: 'Almonds',
    category: 'nut',
    emoji: '🥜',
    defaultWeight_g: 28,
    servingDescription: '1 handful (28g)',
    per100g: {
      sugar_g: 4.4,
      sodium_mg: 1,
      potassium_mg: 733,
      phosphorus_mg: 481,
      fiber_g: 12.5,
      saturatedFat_g: 3.8,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: ['tree_nuts'],
    },
  },

  apple: {
    id: 'prod_apple',
    modelLabel: 'apple',
    displayName: 'Apple',
    category: 'fruit',
    emoji: '🍎',
    defaultWeight_g: 182,
    servingDescription: '1 medium apple (182g)',
    per100g: {
      sugar_g: 10.4,
      sodium_mg: 1,
      potassium_mg: 107,
      phosphorus_mg: 11,
      fiber_g: 2.4,
      saturatedFat_g: 0.1,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  asparagus: {
    id: 'prod_asparagus',
    modelLabel: 'asparagus',
    displayName: 'Asparagus',
    category: 'vegetable',
    emoji: '🥬',
    defaultWeight_g: 90,
    servingDescription: '6 spears (90g)',
    per100g: {
      sugar_g: 1.9,
      sodium_mg: 2,
      potassium_mg: 202,
      phosphorus_mg: 52,
      fiber_g: 2.1,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  avocado: {
    id: 'prod_avocado',
    modelLabel: 'avocado',
    displayName: 'Avocado',
    category: 'fruit',
    emoji: '🥑',
    defaultWeight_g: 150,
    servingDescription: '1 medium avocado (150g)',
    per100g: {
      sugar_g: 0.7,
      sodium_mg: 7,
      potassium_mg: 485,
      phosphorus_mg: 52,
      fiber_g: 6.7,
      saturatedFat_g: 2.1,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  banana: {
    id: 'prod_banana',
    modelLabel: 'banana',
    displayName: 'Banana',
    category: 'fruit',
    emoji: '🍌',
    defaultWeight_g: 118,
    servingDescription: '1 medium banana (118g)',
    per100g: {
      sugar_g: 12.2,
      sodium_mg: 1,
      potassium_mg: 358,
      phosphorus_mg: 22,
      fiber_g: 2.6,
      saturatedFat_g: 0.1,
      cholesterol_mg: 0,
      glycemicIndex: 'medium',
      allergens: [],
    },
  },

  beans: {
    id: 'prod_beans',
    modelLabel: 'beans',
    displayName: 'Beans',
    category: 'legume',
    emoji: '🫘',
    defaultWeight_g: 100,
    servingDescription: '1/2 cup cooked (100g)',
    per100g: {
      sugar_g: 0.3,
      sodium_mg: 2,
      potassium_mg: 355,
      phosphorus_mg: 140,
      fiber_g: 8.7,
      saturatedFat_g: 0.1,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  beet: {
    id: 'prod_beet',
    modelLabel: 'beet',
    displayName: 'Beetroot',
    category: 'vegetable',
    emoji: '🟣',
    defaultWeight_g: 100,
    servingDescription: '1 medium beet (100g)',
    per100g: {
      sugar_g: 6.8,
      sodium_mg: 78,
      potassium_mg: 325,
      phosphorus_mg: 40,
      fiber_g: 2.8,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'medium',
      allergens: [],
    },
  },

  'bell pepper': {
    id: 'prod_bell_pepper',
    modelLabel: 'bell pepper',
    displayName: 'Bell Pepper',
    category: 'vegetable',
    emoji: '🫑',
    defaultWeight_g: 120,
    servingDescription: '1 medium pepper (120g)',
    per100g: {
      sugar_g: 4.2,
      sodium_mg: 3,
      potassium_mg: 211,
      phosphorus_mg: 20,
      fiber_g: 2.1,
      saturatedFat_g: 0.06,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  blackberry: {
    id: 'prod_blackberry',
    modelLabel: 'blackberry',
    displayName: 'Blackberries',
    category: 'fruit',
    emoji: '🫐',
    defaultWeight_g: 100,
    servingDescription: '1 cup (100g)',
    per100g: {
      sugar_g: 4.9,
      sodium_mg: 1,
      potassium_mg: 162,
      phosphorus_mg: 22,
      fiber_g: 5.3,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  blueberry: {
    id: 'prod_blueberry',
    modelLabel: 'blueberry',
    displayName: 'Blueberries',
    category: 'fruit',
    emoji: '🫐',
    defaultWeight_g: 100,
    servingDescription: '1 cup (100g)',
    per100g: {
      sugar_g: 9.96,
      sodium_mg: 1,
      potassium_mg: 77,
      phosphorus_mg: 12,
      fiber_g: 2.4,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  broccoli: {
    id: 'prod_broccoli',
    modelLabel: 'broccoli',
    displayName: 'Broccoli',
    category: 'vegetable',
    emoji: '🥦',
    defaultWeight_g: 91,
    servingDescription: '1 cup chopped (91g)',
    per100g: {
      sugar_g: 1.7,
      sodium_mg: 33,
      potassium_mg: 316,
      phosphorus_mg: 66,
      fiber_g: 2.6,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  'brussels sprouts': {
    id: 'prod_brussels_sprouts',
    modelLabel: 'brussels sprouts',
    displayName: 'Brussels Sprouts',
    category: 'vegetable',
    emoji: '🥬',
    defaultWeight_g: 88,
    servingDescription: '1 cup (88g)',
    per100g: {
      sugar_g: 2.2,
      sodium_mg: 25,
      potassium_mg: 389,
      phosphorus_mg: 69,
      fiber_g: 3.8,
      saturatedFat_g: 0.07,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  cabbage: {
    id: 'prod_cabbage',
    modelLabel: 'cabbage',
    displayName: 'Cabbage',
    category: 'vegetable',
    emoji: '🥬',
    defaultWeight_g: 89,
    servingDescription: '1 cup shredded (89g)',
    per100g: {
      sugar_g: 3.2,
      sodium_mg: 18,
      potassium_mg: 170,
      phosphorus_mg: 26,
      fiber_g: 2.5,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  carrot: {
    id: 'prod_carrot',
    modelLabel: 'carrot',
    displayName: 'Carrot',
    category: 'vegetable',
    emoji: '🥕',
    defaultWeight_g: 61,
    servingDescription: '1 medium carrot (61g)',
    per100g: {
      sugar_g: 4.7,
      sodium_mg: 69,
      potassium_mg: 320,
      phosphorus_mg: 35,
      fiber_g: 2.8,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  cauliflower: {
    id: 'prod_cauliflower',
    modelLabel: 'cauliflower',
    displayName: 'Cauliflower',
    category: 'vegetable',
    emoji: '🥦',
    defaultWeight_g: 107,
    servingDescription: '1 cup chopped (107g)',
    per100g: {
      sugar_g: 1.9,
      sodium_mg: 30,
      potassium_mg: 299,
      phosphorus_mg: 44,
      fiber_g: 2.0,
      saturatedFat_g: 0.05,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  celery: {
    id: 'prod_celery',
    modelLabel: 'celery',
    displayName: 'Celery',
    category: 'vegetable',
    emoji: '🥬',
    defaultWeight_g: 80,
    servingDescription: '2 medium stalks (80g)',
    per100g: {
      sugar_g: 1.3,
      sodium_mg: 80,
      potassium_mg: 260,
      phosphorus_mg: 24,
      fiber_g: 1.6,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  cherry: {
    id: 'prod_cherry',
    modelLabel: 'cherry',
    displayName: 'Cherries',
    category: 'fruit',
    emoji: '🍒',
    defaultWeight_g: 100,
    servingDescription: '12 cherries (100g)',
    per100g: {
      sugar_g: 12.8,
      sodium_mg: 0,
      potassium_mg: 222,
      phosphorus_mg: 21,
      fiber_g: 2.1,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  corn: {
    id: 'prod_corn',
    modelLabel: 'corn',
    displayName: 'Sweet Corn',
    category: 'vegetable',
    emoji: '🌽',
    defaultWeight_g: 90,
    servingDescription: '1 medium ear (90g)',
    per100g: {
      sugar_g: 6.3,
      sodium_mg: 15,
      potassium_mg: 270,
      phosphorus_mg: 89,
      fiber_g: 2.0,
      saturatedFat_g: 0.2,
      cholesterol_mg: 0,
      glycemicIndex: 'medium',
      allergens: [],
    },
  },

  cucumber: {
    id: 'prod_cucumber',
    modelLabel: 'cucumber',
    displayName: 'Cucumber',
    category: 'vegetable',
    emoji: '🥒',
    defaultWeight_g: 100,
    servingDescription: '1/2 cucumber (100g)',
    per100g: {
      sugar_g: 1.7,
      sodium_mg: 2,
      potassium_mg: 147,
      phosphorus_mg: 24,
      fiber_g: 0.5,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  egg: {
    id: 'prod_egg',
    modelLabel: 'egg',
    displayName: 'Boiled Egg',
    category: 'protein',
    emoji: '🥚',
    defaultWeight_g: 50,
    servingDescription: '1 large egg (50g)',
    per100g: {
      sugar_g: 0.4,
      sodium_mg: 124,
      potassium_mg: 126,
      phosphorus_mg: 172,
      fiber_g: 0.0,
      saturatedFat_g: 3.3,
      cholesterol_mg: 372,
      glycemicIndex: 'low',
      allergens: ['egg'],
    },
  },

  eggplant: {
    id: 'prod_eggplant',
    modelLabel: 'eggplant',
    displayName: 'Eggplant',
    category: 'vegetable',
    emoji: '🍆',
    defaultWeight_g: 100,
    servingDescription: '1 cup cubed (100g)',
    per100g: {
      sugar_g: 3.5,
      sodium_mg: 2,
      potassium_mg: 229,
      phosphorus_mg: 24,
      fiber_g: 3.0,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  garlic: {
    id: 'prod_garlic',
    modelLabel: 'garlic',
    displayName: 'Garlic',
    category: 'vegetable',
    emoji: '🧄',
    defaultWeight_g: 10,
    servingDescription: '3 cloves (10g)',
    per100g: {
      sugar_g: 1.0,
      sodium_mg: 17,
      potassium_mg: 401,
      phosphorus_mg: 153,
      fiber_g: 2.1,
      saturatedFat_g: 0.09,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  grape: {
    id: 'prod_grape',
    modelLabel: 'grape',
    displayName: 'Grapes',
    category: 'fruit',
    emoji: '🍇',
    defaultWeight_g: 100,
    servingDescription: '1 cup grapes (100g)',
    per100g: {
      sugar_g: 15.5,
      sodium_mg: 2,
      potassium_mg: 191,
      phosphorus_mg: 20,
      fiber_g: 0.9,
      saturatedFat_g: 0.05,
      cholesterol_mg: 0,
      glycemicIndex: 'medium',
      allergens: [],
    },
  },

  'green bean': {
    id: 'prod_green_bean',
    modelLabel: 'green bean',
    displayName: 'Green Beans',
    category: 'vegetable',
    emoji: '🫛',
    defaultWeight_g: 100,
    servingDescription: '1 cup green beans (100g)',
    per100g: {
      sugar_g: 3.3,
      sodium_mg: 6,
      potassium_mg: 211,
      phosphorus_mg: 38,
      fiber_g: 2.7,
      saturatedFat_g: 0.05,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  'green onion': {
    id: 'prod_green_onion',
    modelLabel: 'green onion',
    displayName: 'Green Onions',
    category: 'vegetable',
    emoji: '🧅',
    defaultWeight_g: 25,
    servingDescription: '2 stalks (25g)',
    per100g: {
      sugar_g: 2.3,
      sodium_mg: 16,
      potassium_mg: 276,
      phosphorus_mg: 37,
      fiber_g: 2.6,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  'hot pepper': {
    id: 'prod_hot_pepper',
    modelLabel: 'hot pepper',
    displayName: 'Chili Pepper',
    category: 'vegetable',
    emoji: '🌶️',
    defaultWeight_g: 45,
    servingDescription: '1 pepper (45g)',
    per100g: {
      sugar_g: 5.3,
      sodium_mg: 9,
      potassium_mg: 322,
      phosphorus_mg: 43,
      fiber_g: 1.5,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  kiwi: {
    id: 'prod_kiwi',
    modelLabel: 'kiwi',
    displayName: 'Kiwi',
    category: 'fruit',
    emoji: '🥝',
    defaultWeight_g: 75,
    servingDescription: '1 medium kiwi (75g)',
    per100g: {
      sugar_g: 9.0,
      sodium_mg: 3,
      potassium_mg: 312,
      phosphorus_mg: 34,
      fiber_g: 3.0,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  lemon: {
    id: 'prod_lemon',
    modelLabel: 'lemon',
    displayName: 'Lemon',
    category: 'fruit',
    emoji: '🍋',
    defaultWeight_g: 58,
    servingDescription: '1 medium lemon (58g)',
    per100g: {
      sugar_g: 2.5,
      sodium_mg: 2,
      potassium_mg: 138,
      phosphorus_mg: 16,
      fiber_g: 2.8,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  lettuce: {
    id: 'prod_lettuce',
    modelLabel: 'lettuce',
    displayName: 'Lettuce',
    category: 'vegetable',
    emoji: '🥬',
    defaultWeight_g: 75,
    servingDescription: '1 cup shredded (75g)',
    per100g: {
      sugar_g: 1.2,
      sodium_mg: 8,
      potassium_mg: 247,
      phosphorus_mg: 30,
      fiber_g: 2.1,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  lime: {
    id: 'prod_lime',
    modelLabel: 'lime',
    displayName: 'Lime',
    category: 'fruit',
    emoji: '🍋',
    defaultWeight_g: 67,
    servingDescription: '1 medium lime (67g)',
    per100g: {
      sugar_g: 1.7,
      sodium_mg: 2,
      potassium_mg: 102,
      phosphorus_mg: 18,
      fiber_g: 2.8,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  mandarin: {
    id: 'prod_mandarin',
    modelLabel: 'mandarin',
    displayName: 'Mandarin',
    category: 'fruit',
    emoji: '🍊',
    defaultWeight_g: 88,
    servingDescription: '1 medium mandarin (88g)',
    per100g: {
      sugar_g: 10.6,
      sodium_mg: 2,
      potassium_mg: 166,
      phosphorus_mg: 20,
      fiber_g: 1.8,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  mushroom: {
    id: 'prod_mushroom',
    modelLabel: 'mushroom',
    displayName: 'Mushrooms',
    category: 'vegetable',
    emoji: '🍄',
    defaultWeight_g: 70,
    servingDescription: '1 cup sliced (70g)',
    per100g: {
      sugar_g: 2.0,
      sodium_mg: 5,
      potassium_mg: 318,
      phosphorus_mg: 86,
      fiber_g: 1.0,
      saturatedFat_g: 0.05,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  onion: {
    id: 'prod_onion',
    modelLabel: 'onion',
    displayName: 'Onion',
    category: 'vegetable',
    emoji: '🧅',
    defaultWeight_g: 110,
    servingDescription: '1 medium onion (110g)',
    per100g: {
      sugar_g: 4.2,
      sodium_mg: 4,
      potassium_mg: 146,
      phosphorus_mg: 29,
      fiber_g: 1.7,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  orange: {
    id: 'prod_orange',
    modelLabel: 'orange',
    displayName: 'Orange',
    category: 'fruit',
    emoji: '🍊',
    defaultWeight_g: 131,
    servingDescription: '1 medium orange (131g)',
    per100g: {
      sugar_g: 9.4,
      sodium_mg: 0,
      potassium_mg: 181,
      phosphorus_mg: 14,
      fiber_g: 2.4,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  'pattypan squash': {
    id: 'prod_pattypan_squash',
    modelLabel: 'pattypan squash',
    displayName: 'Pattypan Squash',
    category: 'vegetable',
    emoji: '🟡',
    defaultWeight_g: 130,
    servingDescription: '1 cup sliced (130g)',
    per100g: {
      sugar_g: 2.2,
      sodium_mg: 1,
      potassium_mg: 180,
      phosphorus_mg: 32,
      fiber_g: 1.2,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  pea: {
    id: 'prod_pea',
    modelLabel: 'pea',
    displayName: 'Green Peas',
    category: 'legume',
    emoji: '🫛',
    defaultWeight_g: 100,
    servingDescription: '2/3 cup (100g)',
    per100g: {
      sugar_g: 5.7,
      sodium_mg: 5,
      potassium_mg: 244,
      phosphorus_mg: 108,
      fiber_g: 5.7,
      saturatedFat_g: 0.07,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  peach: {
    id: 'prod_peach',
    modelLabel: 'peach',
    displayName: 'Peach',
    category: 'fruit',
    emoji: '🍑',
    defaultWeight_g: 150,
    servingDescription: '1 medium peach (150g)',
    per100g: {
      sugar_g: 8.4,
      sodium_mg: 0,
      potassium_mg: 190,
      phosphorus_mg: 20,
      fiber_g: 1.5,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  pear: {
    id: 'prod_pear',
    modelLabel: 'pear',
    displayName: 'Pear',
    category: 'fruit',
    emoji: '🍐',
    defaultWeight_g: 178,
    servingDescription: '1 medium pear (178g)',
    per100g: {
      sugar_g: 9.8,
      sodium_mg: 1,
      potassium_mg: 116,
      phosphorus_mg: 12,
      fiber_g: 3.1,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  pineapple: {
    id: 'prod_pineapple',
    modelLabel: 'pineapple',
    displayName: 'Pineapple',
    category: 'fruit',
    emoji: '🍍',
    defaultWeight_g: 100,
    servingDescription: '1 cup chunks (100g)',
    per100g: {
      sugar_g: 9.9,
      sodium_mg: 1,
      potassium_mg: 109,
      phosphorus_mg: 8,
      fiber_g: 1.4,
      saturatedFat_g: 0.01,
      cholesterol_mg: 0,
      glycemicIndex: 'medium',
      allergens: [],
    },
  },

  potato: {
    id: 'prod_potato',
    modelLabel: 'potato',
    displayName: 'Potato',
    category: 'vegetable',
    emoji: '🥔',
    defaultWeight_g: 150,
    servingDescription: '1 medium potato (150g)',
    per100g: {
      sugar_g: 0.8,
      sodium_mg: 6,
      potassium_mg: 421,
      phosphorus_mg: 57,
      fiber_g: 2.2,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'high',
      allergens: [],
    },
  },

  pumpkin: {
    id: 'prod_pumpkin',
    modelLabel: 'pumpkin',
    displayName: 'Pumpkin',
    category: 'vegetable',
    emoji: '🎃',
    defaultWeight_g: 116,
    servingDescription: '1 cup cubed (116g)',
    per100g: {
      sugar_g: 2.8,
      sodium_mg: 1,
      potassium_mg: 340,
      phosphorus_mg: 44,
      fiber_g: 0.5,
      saturatedFat_g: 0.05,
      cholesterol_mg: 0,
      glycemicIndex: 'high',
      allergens: [],
    },
  },

  radish: {
    id: 'prod_radish',
    modelLabel: 'radish',
    displayName: 'Radish',
    category: 'vegetable',
    emoji: '🔴',
    defaultWeight_g: 50,
    servingDescription: '5 radishes (50g)',
    per100g: {
      sugar_g: 1.9,
      sodium_mg: 39,
      potassium_mg: 233,
      phosphorus_mg: 20,
      fiber_g: 1.6,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  raspberry: {
    id: 'prod_raspberry',
    modelLabel: 'raspberry',
    displayName: 'Raspberries',
    category: 'fruit',
    emoji: '🫐',
    defaultWeight_g: 100,
    servingDescription: '1 cup (100g)',
    per100g: {
      sugar_g: 4.4,
      sodium_mg: 1,
      potassium_mg: 151,
      phosphorus_mg: 29,
      fiber_g: 6.5,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  strawberry: {
    id: 'prod_strawberry',
    modelLabel: 'strawberry',
    displayName: 'Strawberries',
    category: 'fruit',
    emoji: '🍓',
    defaultWeight_g: 100,
    servingDescription: '8 strawberries (100g)',
    per100g: {
      sugar_g: 4.9,
      sodium_mg: 1,
      potassium_mg: 153,
      phosphorus_mg: 24,
      fiber_g: 2.0,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  tomato: {
    id: 'prod_tomato',
    modelLabel: 'tomato',
    displayName: 'Tomato',
    category: 'vegetable',
    emoji: '🍅',
    defaultWeight_g: 123,
    servingDescription: '1 medium tomato (123g)',
    per100g: {
      sugar_g: 2.6,
      sodium_mg: 5,
      potassium_mg: 237,
      phosphorus_mg: 24,
      fiber_g: 1.2,
      saturatedFat_g: 0.03,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  'vegetable marrow': {
    id: 'prod_vegetable_marrow',
    modelLabel: 'vegetable marrow',
    displayName: 'Vegetable Marrow',
    category: 'vegetable',
    emoji: '🥒',
    defaultWeight_g: 150,
    servingDescription: '1 cup sliced (150g)',
    per100g: {
      sugar_g: 2.2,
      sodium_mg: 3,
      potassium_mg: 260,
      phosphorus_mg: 38,
      fiber_g: 1.1,
      saturatedFat_g: 0.04,
      cholesterol_mg: 0,
      glycemicIndex: 'low',
      allergens: [],
    },
  },

  watermelon: {
    id: 'prod_watermelon',
    modelLabel: 'watermelon',
    displayName: 'Watermelon',
    category: 'fruit',
    emoji: '🍉',
    defaultWeight_g: 154,
    servingDescription: '1 wedge / cup (154g)',
    per100g: {
      sugar_g: 6.2,
      sodium_mg: 1,
      potassium_mg: 112,
      phosphorus_mg: 11,
      fiber_g: 0.4,
      saturatedFat_g: 0.02,
      cholesterol_mg: 0,
      glycemicIndex: 'high',
      allergens: [],
    },
  },
};

/**
 * Normalizes user health profile from various potential shapes
 */
export const normalizeProduceProfile = (profile: any): {
  conditions: ProduceHealthCondition[];
  allergens: ProduceAllergen[];
} => {
  if (!profile) return { conditions: [], allergens: [] };

  const conditions: ProduceHealthCondition[] = [];
  const rawConds = profile.conditions || profile.medicalConditions || [];

  if (Array.isArray(rawConds)) {
    rawConds.forEach((c: any) => {
      const s = String(c).toLowerCase().replace(/[\s-]+/g, '_');
      if (s === 'diabetes') conditions.push('diabetes');
      if (s === 'high_blood_pressure') conditions.push('high_blood_pressure');
      if (s === 'heart_disease') conditions.push('heart_disease');
      if (s === 'kidney_disease') conditions.push('kidney_disease');
      if (s === 'high_cholesterol') conditions.push('high_cholesterol');
    });
  } else if (typeof rawConds === 'object') {
    if (rawConds.diabetes) conditions.push('diabetes');
    if (rawConds.highBloodPressure || rawConds.high_blood_pressure) conditions.push('high_blood_pressure');
    if (rawConds.heartDisease || rawConds.heart_disease) conditions.push('heart_disease');
    if (rawConds.kidneyDisease || rawConds.kidney_disease) conditions.push('kidney_disease');
    if (rawConds.highCholesterol || rawConds.high_cholesterol) conditions.push('high_cholesterol');
  } else if (typeof rawConds === 'string') {
    const s = rawConds.toLowerCase();
    if (s.includes('diabetes')) conditions.push('diabetes');
    if (s.includes('blood pressure') || s.includes('hypertension')) conditions.push('high_blood_pressure');
    if (s.includes('heart')) conditions.push('heart_disease');
    if (s.includes('kidney') || s.includes('renal')) conditions.push('kidney_disease');
    if (s.includes('cholesterol')) conditions.push('high_cholesterol');
  }

  const allergens: ProduceAllergen[] = [];
  const rawAllergens = profile.allergens || profile.allergies || profile.allergy || [];

  if (Array.isArray(rawAllergens)) {
    rawAllergens.forEach((a: any) => {
      const s = String(a).toLowerCase().replace(/[\s-]+/g, '_');
      if (['dairy', 'egg', 'tree_nuts', 'fish', 'gluten', 'wheat', 'sesame', 'seafood', 'peanuts', 'soy'].includes(s)) {
        allergens.push(s as ProduceAllergen);
      }
    });
  } else if (typeof rawAllergens === 'string') {
    rawAllergens.split(',').forEach((p: string) => {
      const s = p.trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (['dairy', 'egg', 'tree_nuts', 'fish', 'gluten', 'wheat', 'sesame', 'seafood', 'peanuts', 'soy'].includes(s)) {
        allergens.push(s as ProduceAllergen);
      }
    });
  }

  return { conditions, allergens };
};

/**
 * Scales per-100g nutritional metrics to a specific serving weight.
 */
export const calculateScaledNutrients = (
  item: ProduceModelItem,
  weight_g: number
): ScaledNutrients => {
  const factor = Math.max(1, weight_g) / 100;
  return {
    weight_g,
    sugar_g: Math.round(item.per100g.sugar_g * factor * 10) / 10,
    sodium_mg: Math.round(item.per100g.sodium_mg * factor),
    potassium_mg: Math.round(item.per100g.potassium_mg * factor),
    phosphorus_mg: Math.round(item.per100g.phosphorus_mg * factor),
    fiber_g: Math.round(item.per100g.fiber_g * factor * 10) / 10,
    saturatedFat_g: Math.round(item.per100g.saturatedFat_g * factor * 10) / 10,
    cholesterol_mg: Math.round(item.per100g.cholesterol_mg * factor),
    glycemicIndex: item.per100g.glycemicIndex,
  };
};

/**
 * Evaluates produce condition suitability based on portion-scaled nutrients.
 */
export const evaluateProduceCondition = (
  item: ProduceModelItem,
  scaled: ScaledNutrients,
  condition: ProduceHealthCondition,
  allConditions: ProduceHealthCondition[]
): ConditionRuleResult => {
  const hasKidneyDisease = allConditions.includes('kidney_disease');

  switch (condition) {
    case 'diabetes': {
      // ADA guidelines: Low GI preferred. Sugar portion budget: <= 12g safe, > 18g caution/avoid.
      const isLowGI = item.per100g.glycemicIndex === 'low';
      const isHighGI = item.per100g.glycemicIndex === 'high';

      if (isLowGI && scaled.sugar_g <= 10.0) {
        return {
          condition,
          verdict: 'SAFE',
          score: 95,
          reason: `Low GI with only ${scaled.sugar_g}g sugar and ${scaled.fiber_g}g fiber; excellent for steady blood sugar.`,
        };
      }

      if (isHighGI && scaled.sugar_g >= 10.0) {
        return {
          condition,
          verdict: 'AVOID',
          score: 30,
          reason: `High glycemic index with ${scaled.sugar_g}g sugar may cause rapid blood glucose spikes.`,
          caution: 'High glycemic impact: avoid or restrict to very small portions.',
        };
      }

      if (isHighGI || scaled.sugar_g > 15.0) {
        return {
          condition,
          verdict: 'CAUTION',
          score: 55,
          reason: `Moderate sugar load (${scaled.sugar_g}g sugar per ${scaled.weight_g}g serving).`,
          caution: 'Monitor portion sizes to prevent post-meal glucose rise.',
        };
      }

      return {
        condition,
        verdict: 'SAFE',
        score: 80,
        reason: `Controlled sugar (${scaled.sugar_g}g) and healthy fiber (${scaled.fiber_g}g) for diabetes management.`,
      };
    }

    case 'high_blood_pressure': {
      // DASH: High potassium (dilates vessels) + low sodium.
      // CLINICAL CONFLICT: If member also has kidney disease, low potassium takes absolute priority!
      if (hasKidneyDisease) {
        const isRenalSafeK = scaled.potassium_mg <= 250;
        if (scaled.sodium_mg <= 100 && isRenalSafeK) {
          return {
            condition,
            verdict: 'SAFE',
            score: 90,
            reason: `Low sodium (${scaled.sodium_mg}mg) and renal-safe potassium (${scaled.potassium_mg}mg) protecting both BP and kidneys.`,
          };
        }
        return {
          condition,
          verdict: 'AVOID',
          score: 25,
          reason: `Potassium (${scaled.potassium_mg}mg) is restricted due to concurrent kidney disease.`,
          caution: 'Renal potassium limit strictly overrides high blood pressure potassium intake.',
        };
      }

      if (scaled.sodium_mg <= 50 && scaled.potassium_mg >= 250) {
        return {
          condition,
          verdict: 'SAFE',
          score: 98,
          reason: `Rich in potassium (${scaled.potassium_mg}mg) and very low in sodium (${scaled.sodium_mg}mg), actively supporting healthy BP.`,
        };
      }

      if (scaled.sodium_mg <= 100) {
        return {
          condition,
          verdict: 'SAFE',
          score: 85,
          reason: `Low sodium (${scaled.sodium_mg}mg per serving) promotes arterial vascular health.`,
        };
      }

      return {
        condition,
        verdict: 'CAUTION',
        score: 50,
        reason: `Elevated natural sodium (${scaled.sodium_mg}mg) in this portion.`,
        caution: 'Limit portion to keep daily sodium intake low.',
      };
    }

    case 'kidney_disease': {
      // KDIGO / NKF: Low potassium (<= 250mg per portion) and low phosphorus (<= 60mg per portion).
      const isLowK = scaled.potassium_mg <= 250;
      const isLowPhos = scaled.phosphorus_mg <= 60;
      const isLowNa = scaled.sodium_mg <= 100;

      if (isLowK && isLowPhos && isLowNa) {
        return {
          condition,
          verdict: 'SAFE',
          score: 95,
          reason: `Gentle on kidneys with low potassium (${scaled.potassium_mg}mg) and low phosphorus (${scaled.phosphorus_mg}mg).`,
        };
      }

      if (!isLowK) {
        return {
          condition,
          verdict: 'AVOID',
          score: 20,
          reason: `High potassium (${scaled.potassium_mg}mg per serving) exceeds renal tolerance (${scaled.weight_g}g portion).`,
          caution: 'Risk of hyperkalemia. Avoid or consume only under renal dietitian supervision.',
        };
      }

      return {
        condition,
        verdict: 'CAUTION',
        score: 45,
        reason: `Phosphorus (${scaled.phosphorus_mg}mg) is moderately elevated for chronic kidney disease.`,
        caution: 'Consult renal dietitian before adding this to your regular diet.',
      };
    }

    case 'heart_disease': {
      // AHA Guidelines: Low saturated fat (<= 1g), low sodium (<= 100mg), good fiber.
      const isLowSatFat = scaled.saturatedFat_g <= 1.0;
      const isGoodFiber = scaled.fiber_g >= 2.0;

      if (isLowSatFat && isGoodFiber && scaled.sodium_mg <= 80) {
        return {
          condition,
          verdict: 'SAFE',
          score: 95,
          reason: `Virtually zero saturated fat and ${scaled.fiber_g}g fiber to protect heart and arterial health.`,
        };
      }

      if (scaled.cholesterol_mg > 100) {
        return {
          condition,
          verdict: 'CAUTION',
          score: 50,
          reason: `Contains ${scaled.cholesterol_mg}mg dietary cholesterol; limit frequency.`,
          caution: 'Moderation advised for cardiovascular health.',
        };
      }

      if (isLowSatFat) {
        return {
          condition,
          verdict: 'SAFE',
          score: 85,
          reason: `Heart-friendly with negligible saturated fat (${scaled.saturatedFat_g}g).`,
        };
      }

      return {
        condition,
        verdict: 'CAUTION',
        score: 55,
        reason: `Contains ${scaled.saturatedFat_g}g saturated fat; enjoy in small portions.`,
      };
    }

    case 'high_cholesterol': {
      // ESC / AHA: High soluble fiber clears LDL; low saturated fat and dietary cholesterol.
      if (scaled.saturatedFat_g <= 0.5 && scaled.fiber_g >= 2.0) {
        return {
          condition,
          verdict: 'SAFE',
          score: 95,
          reason: `High soluble fiber (${scaled.fiber_g}g) actively helps bind and clear LDL cholesterol.`,
        };
      }

      if (scaled.cholesterol_mg > 100) {
        return {
          condition,
          verdict: 'CAUTION',
          score: 45,
          reason: `Contains ${scaled.cholesterol_mg}mg cholesterol per serving; monitor daily intake.`,
          caution: 'Limit frequency if managing dyslipidemia.',
        };
      }

      if (scaled.saturatedFat_g <= 1.0) {
        return {
          condition,
          verdict: 'SAFE',
          score: 80,
          reason: `Low saturated fat (${scaled.saturatedFat_g}g) supports healthy lipid levels.`,
        };
      }

      return {
        condition,
        verdict: 'CAUTION',
        score: 50,
        reason: `Higher saturated fat (${scaled.saturatedFat_g}g per portion).`,
      };
    }

    default:
      return {
        condition,
        verdict: 'SAFE',
        score: 80,
        reason: 'Wholesome whole food providing essential natural micronutrients.',
      };
  }
};

/**
 * Main evaluation entry point for a detected produce item.
 * 
 * @param modelLabelOrId The model class name (e.g. 'apple', 'banana', 'almond')
 * @param userProfile User's active profile containing medicalConditions and allergies
 * @param servingWeightGrams Optional custom weight; if omitted, uses item's defaultWeight_g
 */
export const evaluateProduceItem = (
  modelLabelOrId: string,
  userProfile?: any,
  servingWeightGrams?: number
): ProduceEvaluationResult => {
  const normalizedKey = (modelLabelOrId || '').toLowerCase().trim();
  const item =
    PRODUCE_MODEL_CATALOG[normalizedKey] ||
    Object.values(PRODUCE_MODEL_CATALOG).find(
      (p) => p.displayName.toLowerCase() === normalizedKey || p.id === normalizedKey
    ) ||
    PRODUCE_MODEL_CATALOG['apple']; // Safe fallback

  const weight_g = servingWeightGrams && servingWeightGrams > 0 ? servingWeightGrams : item.defaultWeight_g;
  const isDefaultWeight = weight_g === item.defaultWeight_g;
  const servingDescription = isDefaultWeight
    ? item.servingDescription
    : `${weight_g}g portion`;

  const scaled = calculateScaledNutrients(item, weight_g);
  const { conditions, allergens } = normalizeProduceProfile(userProfile);

  // 1. Check Allergen Safety (Hard Filter)
  const allergensTriggered: ProduceAllergen[] = item.per100g.allergens.filter((a) =>
    allergens.includes(a)
  );

  if (allergensTriggered.length > 0) {
    const allergenNames = allergensTriggered.join(', ').replace(/_/g, ' ');
    return {
      item,
      servingWeight_g: weight_g,
      servingDescription,
      verdict: 'AVOID',
      suitabilityScore: 0,
      headline: `Allergen Conflict: ${item.displayName}`,
      primaryReason: `Contains ${allergenNames}. Unsafe for your active allergen profile!`,
      allReasons: [`Strict allergen alert: Contains ${allergenNames}.`],
      cautions: [`Do not consume if allergic to ${allergenNames}.`],
      allergensTriggered,
      conditionEvaluations: [],
      scaledNutrients: scaled,
      consumedNutrientHighlights: [
        { label: 'Allergen Alert', value: allergenNames.toUpperCase(), status: 'high' },
        { label: 'Portion Weight', value: `${weight_g}g`, status: 'good' },
      ],
    };
  }

  // 2. Member with NO medical conditions: General whole-food evaluation
  if (conditions.length === 0) {
    const fiberScore = Math.min(25, scaled.fiber_g * 5);
    const sugarPenalty = Math.max(0, (scaled.sugar_g - 12) * 2);
    const score = Math.max(60, Math.min(100, Math.round(80 + fiberScore - sugarPenalty)));
    const cautions: string[] = [];

    if (scaled.sugar_g > 15) {
      cautions.push(`Contains ${scaled.sugar_g}g natural sugars; enjoy as part of a balanced diet.`);
    }

    return {
      item,
      servingWeight_g: weight_g,
      servingDescription,
      verdict: 'SAFE',
      suitabilityScore: score,
      headline: `Nutritious Pick: ${item.displayName}`,
      primaryReason: `Wholesome ${item.category} providing ${scaled.fiber_g}g natural fiber and essential vitamins in ${servingDescription}.`,
      allReasons: [
        `Provides ${scaled.fiber_g}g natural dietary fiber.`,
        scaled.sugar_g <= 5 ? `Naturally low in sugar (${scaled.sugar_g}g).` : `Contains natural fruit sugars (${scaled.sugar_g}g).`,
      ],
      cautions,
      allergensTriggered: [],
      conditionEvaluations: [],
      scaledNutrients: scaled,
      consumedNutrientHighlights: [
        { label: 'Serving', value: `${weight_g}g`, status: 'good' },
        { label: 'Sugar', value: `${scaled.sugar_g}g`, status: scaled.sugar_g <= 10 ? 'good' : 'moderate' },
        { label: 'Fiber', value: `${scaled.fiber_g}g`, status: 'good' },
        { label: 'Potassium', value: `${scaled.potassium_mg}mg`, status: 'good' },
      ],
    };
  }

  // 3. Evaluate against active conditions
  const conditionEvaluations: ConditionRuleResult[] = conditions.map((cond) =>
    evaluateProduceCondition(item, scaled, cond, conditions)
  );

  const hasAvoid = conditionEvaluations.some((c) => c.verdict === 'AVOID');
  const hasCaution = conditionEvaluations.some((c) => c.verdict === 'CAUTION');

  let overallVerdict: ProduceVerdict = 'SAFE';
  if (hasAvoid) {
    overallVerdict = 'AVOID';
  } else if (hasCaution) {
    overallVerdict = 'CAUTION';
  }

  const totalScore = conditionEvaluations.reduce((sum, c) => sum + c.score, 0);
  const suitabilityScore = Math.round(totalScore / conditionEvaluations.length);

  const allReasons = conditionEvaluations.map((c) => c.reason);
  const cautions = conditionEvaluations
    .map((c) => c.caution)
    .filter((c): c is string => typeof c === 'string' && c.length > 0);

  const primaryEval = conditionEvaluations.find((c) => c.verdict === overallVerdict) || conditionEvaluations[0];
  const primaryReason = primaryEval.reason;

  const headline =
    overallVerdict === 'SAFE'
      ? `Recommended: ${item.displayName}`
      : overallVerdict === 'CAUTION'
      ? `Caution for ${item.displayName}`
      : `Limit / Avoid: ${item.displayName}`;

  return {
    item,
    servingWeight_g: weight_g,
    servingDescription,
    verdict: overallVerdict,
    suitabilityScore,
    headline,
    primaryReason,
    allReasons,
    cautions,
    allergensTriggered: [],
    conditionEvaluations,
    scaledNutrients: scaled,
    consumedNutrientHighlights: [
      { label: 'Portion', value: `${weight_g}g`, status: 'good' },
      { label: 'Sugar', value: `${scaled.sugar_g}g`, status: scaled.sugar_g <= 8 ? 'good' : scaled.sugar_g <= 15 ? 'moderate' : 'high' },
      { label: 'Potassium', value: `${scaled.potassium_mg}mg`, status: conditions.includes('kidney_disease') && scaled.potassium_mg > 250 ? 'high' : 'good' },
      { label: 'Fiber', value: `${scaled.fiber_g}g`, status: scaled.fiber_g >= 2 ? 'good' : 'moderate' },
      { label: 'Sodium', value: `${scaled.sodium_mg}mg`, status: scaled.sodium_mg <= 50 ? 'good' : 'moderate' },
    ],
  };
};

/**
 * Checks if a detected label is within the 47 supported model classes.
 */
export const isProduceClassSupported = (label: string): boolean => {
  if (!label) return false;
  const normalized = label.toLowerCase().trim();
  return SUPPORTED_PRODUCE_CLASSES.includes(normalized);
};

/**
 * Retrieves the default serving weight for a produce model class.
 */
export const getProduceDefaultWeight = (label: string): number => {
  const normalized = (label || '').toLowerCase().trim();
  const item = PRODUCE_MODEL_CATALOG[normalized];
  return item ? item.defaultWeight_g : 100;
};

/**
 * Returns all 47 supported produce items.
 */
export const getAllSupportedProduceItems = (): ProduceModelItem[] => {
  return Object.values(PRODUCE_MODEL_CATALOG);
};
