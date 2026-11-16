/**
 * Unit Tests for NutriLens Recommendation Engine
 * 
 * Verifies:
 * 1. Single health conditions (diabetes, high_blood_pressure, kidney_disease, heart_disease, high_cholesterol)
 * 2. Multi-condition conflicts (Kidney Disease + High Blood Pressure potassium reversal)
 * 3. Allergen hard-filter (zero tolerance, never relaxed)
 * 4. No-conditions baseline (general healthy recommendations)
 * 5. Daily seed determinism & rotation
 * 6. Empty pool fallback & caution labeling
 * 7. Packed food candidate evaluation & ranking
 */

import {
  getRecommendations,
  recommendProduceList,
  recommendPackedFoods,
  getDateSeed,
  CandidatePackedFood,
  getPackedFoodEmoji,
} from '../services/recommendationEngine';
import {
  VEGETABLE_CATALOG,
  FRUIT_CATALOG,
  ProduceItem,
  evaluateProduceConditionSuitability,
} from '../data/produceCatalog';
import { HealthCondition, Allergen } from '../services/nutrilens_health_rules';

describe('NutriLens Recommendation Engine', () => {
  // --------------------------------------------------------------------------
  // 1. Single Health Conditions
  // --------------------------------------------------------------------------
  describe('Single Condition Suitability', () => {
    test('Diabetes: recommends low-sugar, low-GI, high-fiber produce', () => {
      const output = getRecommendations({
        conditions: ['diabetes'],
        allergens: [],
        seed: 42,
        limit: 6,
      });

      expect(output.vegetables.length).toBeGreaterThan(0);
      expect(output.fruits.length).toBeGreaterThan(0);

      // Verify all recommended vegetables meet diabetes low-GI/low-sugar criteria
      output.vegetables.forEach(item => {
        expect(item.glycemicIndex).toBe('low');
        expect(item.nutrients?.sugar_g).toBeLessThanOrEqual(5.0);
        expect(item.reasons.some(r => r.toLowerCase().includes('sugar') || r.toLowerCase().includes('glucose'))).toBe(true);
      });

      // Boiled potatoes (high GI) must NOT be recommended for diabetes
      const vegNames = output.vegetables.map(v => v.name.toLowerCase());
      expect(vegNames).not.toContain('potato (boiled)');

      // High-sugar fruits (like Mango, Red Grapes) must NOT be recommended for diabetes
      const fruitNames = output.fruits.map(f => f.name.toLowerCase());
      expect(fruitNames).not.toContain('mango');
      expect(fruitNames).not.toContain('red grapes');
    });

    test('High Blood Pressure: prioritizes low sodium and potassium-rich items', () => {
      const output = getRecommendations({
        conditions: ['high_blood_pressure'],
        allergens: [],
        seed: 42,
        limit: 6,
      });

      expect(output.vegetables.length).toBeGreaterThan(0);
      output.vegetables.forEach(item => {
        // Low sodium produce
        expect(item.nutrients?.sodium_mg).toBeLessThanOrEqual(70);
        expect(item.reasons.some(r => r.toLowerCase().includes('blood pressure') || r.toLowerCase().includes('sodium'))).toBe(true);
      });
    });

    test('Kidney Disease: strictly requires LOW potassium (<=200mg) and LOW phosphorus (<=50mg)', () => {
      const output = getRecommendations({
        conditions: ['kidney_disease'],
        allergens: [],
        seed: 42,
        limit: 6,
      });

      expect(output.vegetables.length).toBeGreaterThan(0);
      expect(output.fruits.length).toBeGreaterThan(0);

      // Verify all items have potassium <= 200mg
      output.vegetables.forEach(item => {
        expect(item.nutrients?.potassium_mg).toBeLessThanOrEqual(200);
        expect(item.nutrients?.phosphorus_mg).toBeLessThanOrEqual(50);
      });

      output.fruits.forEach(item => {
        expect(item.nutrients?.potassium_mg).toBeLessThanOrEqual(200);
      });

      // High-potassium vegetables (spinach: 558mg, kale: 447mg) MUST be excluded
      const vegNames = output.vegetables.map(v => v.name.toLowerCase());
      expect(vegNames).not.toContain('spinach');
      expect(vegNames).not.toContain('kale');

      // High-potassium fruits (bananas: 358mg, avocados: 485mg, kiwi: 312mg) MUST be excluded
      const fruitNames = output.fruits.map(f => f.name.toLowerCase());
      expect(fruitNames).not.toContain('banana');
      expect(fruitNames).not.toContain('avocado');
      expect(fruitNames).not.toContain('kiwi');
    });

    test('Heart Disease: requires low saturated fat and dietary fiber', () => {
      const output = getRecommendations({
        conditions: ['heart_disease'],
        allergens: [],
        seed: 123,
        limit: 6,
      });

      output.vegetables.forEach(item => {
        expect(item.nutrients?.saturatedFat_g).toBeLessThanOrEqual(0.5);
        expect(item.conditionsSatisfied).toContain('heart_disease');
      });
    });

    test('High Cholesterol: prioritizes high fiber and low saturated fat produce', () => {
      const output = getRecommendations({
        conditions: ['high_cholesterol'],
        allergens: [],
        seed: 123,
        limit: 6,
      });

      output.vegetables.forEach(item => {
        expect(item.nutrients?.saturatedFat_g).toBeLessThanOrEqual(0.5);
        expect(item.conditionsSatisfied).toContain('high_cholesterol');
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. Multi-Condition Conflict: Kidney Disease + High Blood Pressure
  // --------------------------------------------------------------------------
  describe('Multi-Condition Conflict (Kidney Disease + High Blood Pressure)', () => {
    test('Renal low-potassium safety strictly overrules HBP potassium intake', () => {
      const conditions: HealthCondition[] = ['kidney_disease', 'high_blood_pressure'];
      const output = getRecommendations({
        conditions,
        allergens: [],
        seed: 99,
        limit: 6,
      });

      // Acceptance Criteria:
      // "A member with both kidney disease and high blood pressure never sees high-potassium items."
      output.vegetables.forEach(item => {
        expect(item.nutrients?.potassium_mg).toBeLessThanOrEqual(200);
      });

      output.fruits.forEach(item => {
        expect(item.nutrients?.potassium_mg).toBeLessThanOrEqual(200);
      });

      const allNames = [
        ...output.vegetables.map(v => v.name.toLowerCase()),
        ...output.fruits.map(f => f.name.toLowerCase()),
      ];

      expect(allNames).not.toContain('spinach');
      expect(allNames).not.toContain('banana');
      expect(allNames).not.toContain('avocado');
      expect(allNames).not.toContain('kale');
      expect(allNames).not.toContain('sweet potato');

      // Low potassium items like cucumber (147mg), green cabbage (170mg), gala apple (107mg) qualify
      const qualifyingRenalSafePresent = allNames.some(name =>
        ['cucumber', 'green cabbage', 'gala apple', 'blueberry', 'green bell pepper'].includes(name)
      );
      expect(qualifyingRenalSafePresent).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Allergen Hard Filter
  // --------------------------------------------------------------------------
  describe('Allergen Hard Filter', () => {
    test('Member with peanut allergy never sees peanut items', () => {
      const mockCatalog: ProduceItem[] = [
        {
          id: 'item_safe_apple',
          name: 'Organic Apple',
          category: 'fruit',
          emoji: '🍎',
          sugar_g: 5.0,
          sodium_mg: 1,
          potassium_mg: 100,
          phosphorus_mg: 10,
          fiber_g: 2.5,
          saturatedFat_g: 0.01,
          glycemicIndex: 'low',
          allergens: [],
        },
        {
          id: 'item_peanut_snack',
          name: 'Roasted Peanuts',
          category: 'vegetable',
          emoji: '🥜',
          sugar_g: 4.0,
          sodium_mg: 5,
          potassium_mg: 150,
          phosphorus_mg: 30,
          fiber_g: 5.0,
          saturatedFat_g: 0.1,
          glycemicIndex: 'low',
          allergens: ['peanuts'],
        },
      ];

      const result = recommendProduceList(mockCatalog, ['diabetes'], ['peanuts'], 1);
      const names = result.map(r => r.name);
      expect(names).toContain('Organic Apple');
      expect(names).not.toContain('Roasted Peanuts');
    });

    test('Packed food candidate with allergen tag is completely filtered out', () => {
      const candidates: CandidatePackedFood[] = [
        {
          id: '1',
          product_name: 'Safe Whole Oats',
          ingredients_en: 'Whole grain oats',
          allergens_tags: [],
          traces_tags: [],
          sugars_100g: 1.0,
          sodium_100g: 0.01,
          sat_fat_100g: 0.5,
        },
        {
          id: '2',
          product_name: 'Peanut Butter Crunch',
          ingredients_en: 'Peanuts, palm oil, salt',
          allergens_tags: ['en:peanuts'],
          traces_tags: [],
          sugars_100g: 3.0,
          sodium_100g: 0.1,
          sat_fat_100g: 1.0,
        },
        {
          id: '3',
          product_name: 'Granola Bar with Peanut traces',
          ingredients_en: 'Oats, honey',
          allergens_tags: [],
          traces_tags: ['en:peanuts'],
          sugars_100g: 3.0,
          sodium_100g: 0.05,
          sat_fat_100g: 0.5,
        },
      ];

      const recommended = recommendPackedFoods(candidates, ['diabetes'], ['peanuts'], 0);
      const names = recommended.map(p => p.name);
      expect(names).toContain('Safe Whole Oats');
      expect(names).not.toContain('Peanut Butter Crunch');
      expect(names).not.toContain('Granola Bar with Peanut traces');
    });
  });

  // --------------------------------------------------------------------------
  // 4. No Conditions (General Healthy Baseline)
  // --------------------------------------------------------------------------
  describe('No Conditions Baseline', () => {
    test('Returns general healthy recommendations when member has no medical conditions', () => {
      const output = getRecommendations({
        conditions: [],
        allergens: [],
        seed: 77,
        limit: 6,
      });

      expect(output.vegetables.length).toBe(6);
      expect(output.fruits.length).toBe(6);

      output.vegetables.forEach(item => {
        expect(item.suitabilityScore).toBeGreaterThanOrEqual(50);
        expect(item.reasons.length).toBeGreaterThan(0);
        expect(item.conditionsSatisfied).toEqual([]);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 5. Daily Seed Determinism & Rotation
  // --------------------------------------------------------------------------
  describe('Daily Seed Determinism & Rotation', () => {
    test('Identical seed yields exact identical recommendations', () => {
      const run1 = getRecommendations({
        conditions: ['diabetes'],
        allergens: [],
        seed: 20261101,
        limit: 5,
      });

      const run2 = getRecommendations({
        conditions: ['diabetes'],
        allergens: [],
        seed: 20261101,
        limit: 5,
      });

      const run1VegIds = run1.vegetables.map(v => v.id);
      const run2VegIds = run2.vegetables.map(v => v.id);
      expect(run1VegIds).toEqual(run2VegIds);

      const run1FruitIds = run1.fruits.map(f => f.id);
      const run2FruitIds = run2.fruits.map(f => f.id);
      expect(run1FruitIds).toEqual(run2FruitIds);
    });

    test('Different seed (next day) rotates the recommendation order/picks', () => {
      const day1 = getRecommendations({
        conditions: ['diabetes'],
        allergens: [],
        seed: 20261101,
        limit: 4,
      });

      const day2 = getRecommendations({
        conditions: ['diabetes'],
        allergens: [],
        seed: 20261102,
        limit: 4,
      });

      const day1Ids = day1.vegetables.map(v => v.id);
      const day2Ids = day2.vegetables.map(v => v.id);

      // Same qualifying pool, but shuffled differently across days
      const isIdenticalOrder = JSON.stringify(day1Ids) === JSON.stringify(day2Ids);
      // With different seeds, order or items should differ
      expect(isIdenticalOrder).toBe(false);
    });

    test('getDateSeed returns proper integer date', () => {
      const fixedDate = new Date(2026, 10, 1); // Nov 1, 2026 (0-indexed month)
      const seed = getDateSeed(fixedDate);
      expect(seed).toBe(20261101);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Empty Pool Fallback & Caution Labeling
  // --------------------------------------------------------------------------
  describe('Empty Pool Fallback & Caution Labeling', () => {
    test('Relaxes to suitable-for-most and attaches caution label when no item fits all', () => {
      // Create an artificial catalog where no single item satisfies all 3 conditions
      const strictSyntheticCatalog: ProduceItem[] = [
        {
          id: 'item_1',
          name: 'Item A',
          category: 'vegetable',
          emoji: '🥦',
          sugar_g: 2.0, // fits diabetes
          sodium_mg: 20,
          potassium_mg: 450, // fits HBP potassium, but FAILS kidney disease
          phosphorus_mg: 30,
          fiber_g: 3.0,
          saturatedFat_g: 0.05,
          glycemicIndex: 'low',
          allergens: [],
        },
      ];

      // Item A satisfies diabetes and HBP, but fails kidney disease
      const result = recommendProduceList(
        strictSyntheticCatalog,
        ['diabetes', 'kidney_disease', 'high_blood_pressure'],
        [],
        1,
        5
      );

      expect(result.length).toBeGreaterThan(0);
      const item = result[0];
      // Must contain caution explaining condition that was not met
      expect(item.cautions.length).toBeGreaterThan(0);
      expect(item.cautions.some(c => c.toLowerCase().includes('caution') || c.toLowerCase().includes('kidney'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Packed Food Evaluator Integration
  // --------------------------------------------------------------------------
  describe('Packed Food Evaluator Integration', () => {
    test('Only products with safe verdict and zero allergen flags qualify', () => {
      const candidates: CandidatePackedFood[] = [
        {
          id: 101,
          product_name: 'Organic Rolled Oats',
          ingredients_en: 'Whole grain oats',
          allergens_tags: [],
          traces_tags: [],
          sugars_100g: 0.8,
          sodium_100g: 0.01,
          sat_fat_100g: 0.4,
        },
        {
          id: 102,
          product_name: 'High Sugar Candy',
          ingredients_en: 'Sugar, corn syrup',
          allergens_tags: [],
          traces_tags: [],
          sugars_100g: 65.0, // High sugar, fails diabetes
          sodium_100g: 0.05,
          sat_fat_100g: 0.1,
        },
      ];

      const result = recommendPackedFoods(candidates, ['diabetes'], [], 0, 6);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Organic Rolled Oats');
      expect(result[0].suitabilityScore).toBeGreaterThanOrEqual(70);
      expect(result[0].reasons.some(r => r.includes('diabetes'))).toBe(true);
    });
    test('Assigns contextual, product-relevant food emoji', () => {
      expect(getPackedFoodEmoji('Organic Rolled Oats')).toBe('🥣');
      expect(getPackedFoodEmoji('Orange pineapple juice')).toBe('🧃');
      expect(getPackedFoodEmoji('Green Tea with Lemon')).toBe('🍵');
      expect(getPackedFoodEmoji('Sparkling Mineral Water')).toBe('🥤');
      expect(getPackedFoodEmoji('Part Skim Ricotta Cheese')).toBe('🧀');
      expect(getPackedFoodEmoji('Whole Wheat Bread')).toBe('🍞');
      expect(getPackedFoodEmoji('Lentil Vegetable Soup')).toBe('🍲');
      expect(getPackedFoodEmoji('Wild Albacore Tuna')).toBe('🐟');
    });
  });
});

