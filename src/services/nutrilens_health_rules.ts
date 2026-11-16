/**
 * NutriLens Health Rules - Deterministic Rule Engine
 * 
 * Re-exports the core health engine types, scoring, and rule evaluation.
 * Evaluates food against 5 closed health conditions and 10 allergens.
 */

import {
  MedicalCondition,
  Allergy,
  DetectedFoodData,
  UserHealthProfile,
  HealthEvaluationResult,
  Verdict,
  Severity,
  FlaggedIngredient,
  ConditionWarning,
  RuleResult
} from './healthEngine/types';
import { evaluateFoodSafety } from './healthEngine/index';

// 5 closed health conditions
export type HealthCondition =
  | 'diabetes'
  | 'high_blood_pressure'
  | 'heart_disease'
  | 'kidney_disease'
  | 'high_cholesterol';

// 10 closed allergens
export type Allergen =
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

// Re-export core types for interoperability
export {
  MedicalCondition,
  Allergy,
  DetectedFoodData,
  UserHealthProfile,
  HealthEvaluationResult,
  Verdict,
  Severity,
  FlaggedIngredient,
  ConditionWarning,
  RuleResult,
  evaluateFoodSafety
};

export const ALL_HEALTH_CONDITIONS: HealthCondition[] = [
  'diabetes',
  'high_blood_pressure',
  'heart_disease',
  'kidney_disease',
  'high_cholesterol'
];

export const ALL_ALLERGENS: Allergen[] = [
  'dairy',
  'egg',
  'tree_nuts',
  'fish',
  'gluten',
  'wheat',
  'sesame',
  'seafood',
  'peanuts',
  'soy'
];

