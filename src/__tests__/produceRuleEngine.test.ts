import {
  SUPPORTED_PRODUCE_CLASSES,
  PRODUCE_MODEL_CATALOG,
  evaluateProduceItem,
  isProduceClassSupported,
  getProduceDefaultWeight,
  getAllSupportedProduceItems,
} from '../services/produceRuleEngine';

describe('Produce Rule Engine (47 Model Classes)', () => {
  test('Contains exactly 47 supported model classes', () => {
    expect(SUPPORTED_PRODUCE_CLASSES.length).toBe(47);
    const catalogKeys = Object.keys(PRODUCE_MODEL_CATALOG);
    expect(catalogKeys.length).toBe(47);

    SUPPORTED_PRODUCE_CLASSES.forEach((label) => {
      expect(PRODUCE_MODEL_CATALOG[label]).toBeDefined();
      expect(PRODUCE_MODEL_CATALOG[label].defaultWeight_g).toBeGreaterThan(0);
      expect(PRODUCE_MODEL_CATALOG[label].per100g).toBeDefined();
    });
  });

  test('isProduceClassSupported correctly identifies model classes', () => {
    expect(isProduceClassSupported('apple')).toBe(true);
    expect(isProduceClassSupported('banana')).toBe(true);
    expect(isProduceClassSupported('pattypan squash')).toBe(true);
    expect(isProduceClassSupported('vegetable marrow')).toBe(true);
    expect(isProduceClassSupported('almond')).toBe(true);
    expect(isProduceClassSupported('egg')).toBe(true);
    expect(isProduceClassSupported('pizza')).toBe(false);
  });

  test('Uses clinical default weight when no custom weight is provided', () => {
    const appleEval = evaluateProduceItem('apple', { conditions: ['diabetes'] });
    expect(appleEval.servingWeight_g).toBe(182); // 1 medium apple = 182g
    expect(appleEval.servingDescription).toContain('182g');

    const almondEval = evaluateProduceItem('almond', { conditions: [] });
    expect(almondEval.servingWeight_g).toBe(28); // 1 handful = 28g
  });

  test('Scales nutrient intake proportionally when custom weight is provided', () => {
    // 100g apple has 10.4g sugar
    const eval100g = evaluateProduceItem('apple', { conditions: [] }, 100);
    expect(eval100g.scaledNutrients.sugar_g).toBe(10.4);

    // 200g apple should have 20.8g sugar
    const eval200g = evaluateProduceItem('apple', { conditions: [] }, 200);
    expect(eval200g.scaledNutrients.sugar_g).toBe(20.8);
  });

  describe('Diabetes Rules', () => {
    test('Recommends low-GI, low-sugar produce for diabetes (e.g. broccoli, cucumber)', () => {
      const res = evaluateProduceItem('broccoli', { conditions: ['diabetes'] });
      expect(res.verdict).toBe('SAFE');
      expect(res.conditionEvaluations[0].verdict).toBe('SAFE');
      expect(res.suitabilityScore).toBeGreaterThanOrEqual(80);
    });

    test('Flags high-GI produce (e.g. watermelon, potato) with caution/avoid for diabetes', () => {
      const resWatermelon = evaluateProduceItem('watermelon', { conditions: ['diabetes'] });
      expect(['CAUTION', 'AVOID']).toContain(resWatermelon.verdict);
      expect(resWatermelon.cautions.length).toBeGreaterThan(0);
    });
  });

  describe('Kidney Disease vs High Blood Pressure Conflict', () => {
    test('HBP user without kidney disease receives high potassium recommendations (e.g. avocado, banana)', () => {
      const res = evaluateProduceItem('avocado', { conditions: ['high_blood_pressure'] });
      expect(res.verdict).toBe('SAFE');
      expect(res.primaryReason).toContain('potassium');
    });

    test('Kidney disease strictly avoids high potassium produce (e.g. avocado, potato, banana)', () => {
      const resAvocado = evaluateProduceItem('avocado', { conditions: ['kidney_disease'] });
      expect(resAvocado.verdict).toBe('AVOID');
      expect(resAvocado.cautions.some((c) => c.toLowerCase().includes('hyperkalemia') || c.toLowerCase().includes('potassium'))).toBe(true);
    });

    test('Concurrent HBP + Kidney Disease: renal low-potassium limit strictly overrules HBP potassium recommendation', () => {
      const resConflict = evaluateProduceItem('banana', {
        conditions: ['high_blood_pressure', 'kidney_disease'],
      });
      expect(resConflict.verdict).toBe('AVOID');
      const hbpEval = resConflict.conditionEvaluations.find((c) => c.condition === 'high_blood_pressure');
      expect(hbpEval?.verdict).toBe('AVOID');
      expect(hbpEval?.reason).toContain('restricted due to concurrent kidney disease');
    });

    test('Recommends renal-safe low-potassium produce (e.g. apple, cucumber, cabbage) for kidney disease', () => {
      const resApple = evaluateProduceItem('apple', { conditions: ['kidney_disease'] });
      expect(resApple.verdict).toBe('SAFE');
      expect(resApple.conditionEvaluations[0].verdict).toBe('SAFE');
    });
  });

  describe('Allergen Hard Filtering', () => {
    test('Almond triggers tree_nuts allergy and marks AVOID with 0 score', () => {
      const res = evaluateProduceItem('almond', { allergens: ['tree_nuts'] });
      expect(res.verdict).toBe('AVOID');
      expect(res.suitabilityScore).toBe(0);
      expect(res.allergensTriggered).toContain('tree_nuts');
      expect(res.primaryReason).toContain('tree nuts');
    });

    test('Egg triggers egg allergy and marks AVOID with 0 score', () => {
      const res = evaluateProduceItem('egg', { allergens: ['egg'] });
      expect(res.verdict).toBe('AVOID');
      expect(res.suitabilityScore).toBe(0);
      expect(res.allergensTriggered).toContain('egg');
    });

    test('Safe from allergies when member has non-matching allergy', () => {
      const res = evaluateProduceItem('apple', { allergens: ['peanuts', 'dairy'] });
      expect(res.verdict).toBe('SAFE');
      expect(res.allergensTriggered.length).toBe(0);
    });
  });

  describe('Multi-condition & Baseline', () => {
    test('Evaluates wholesome baseline for user with no medical conditions', () => {
      const res = evaluateProduceItem('carrot', { conditions: [], allergens: [] });
      expect(res.verdict).toBe('SAFE');
      expect(res.headline).toContain('Carrot');
      expect(res.scaledNutrients.fiber_g).toBeGreaterThan(0);
    });

    test('Normalizes legacy string or object profile formats', () => {
      const legacyProfile = {
        medicalConditions: 'Diabetes, High Blood Pressure',
        allergies: 'Tree Nuts',
      };
      const res = evaluateProduceItem('almond', legacyProfile);
      expect(res.verdict).toBe('AVOID');
      expect(res.allergensTriggered).toContain('tree_nuts');
    });
  });
});
