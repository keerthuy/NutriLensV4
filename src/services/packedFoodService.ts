/**
 * Packed Food Recommendation Service
 * 
 * Interacts with the local SQLite product database (~10,000 Open Food Facts products).
 * Uses indexed, parameterized SQL queries with strict LIMIT to avoid memory bloat.
 * Evaluates candidate products against the deterministic health engine rules.
 */

import * as SQLite from 'expo-sqlite';
import { HealthCondition, Allergen } from './nutrilens_health_rules';
import {
  CandidatePackedFood,
  RecommendedItem,
  recommendPackedFoods,
  cleanProductName,
} from './recommendationEngine';
import { initIngredientDatabase } from './nutrition/ingredientDatabase';

const DB_NAME = 'nutrilens_ingredients.db';
let databaseInstance: SQLite.SQLiteDatabase | null = null;
let indexInitialized = false;

const parseJsonField = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Ensures the database is initialized and secondary index exists.
 */
const getDatabase = async (): Promise<SQLite.SQLiteDatabase | null> => {
  try {
    if (!databaseInstance) {
      await initIngredientDatabase();
      databaseInstance = await SQLite.openDatabaseAsync(DB_NAME);
    }

    if (databaseInstance && !indexInitialized) {
      // Ensure index on primary nutrient filter columns for fast parameterized queries
      await databaseInstance.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_ingredients_nutrients 
        ON ingredients_library (sugars_100g, sodium_100g, sat_fat_100g);
      `);
      indexInitialized = true;
    }

    return databaseInstance;
  } catch (err) {
    console.warn('[PackedFoodService] Could not connect to SQLite database:', err);
    return null;
  }
};

/**
 * Fetches candidate packed foods from SQLite database using indexed parameterized query.
 */
export const queryCandidatePackedFoods = async (
  conditions: HealthCondition[],
  allergens: Allergen[],
  limit: number = 30,
  offset: number = 0
): Promise<CandidatePackedFood[]> => {
  const db = await getDatabase();
  if (!db) {
    return [];
  }

  const whereClauses: string[] = [
    "product_name IS NOT NULL",
    "product_name != ''",
  ];
  const params: any[] = [];

  // Parameterized Condition Nutrient Filters
  if (conditions.includes('diabetes')) {
    whereClauses.push("sugars_100g IS NOT NULL AND sugars_100g <= ?");
    params.push(15.0); // max 15g sugar threshold for adult evaluation
  }

  if (conditions.includes('high_blood_pressure')) {
    whereClauses.push("sodium_100g IS NOT NULL AND sodium_100g <= ?");
    params.push(0.40); // 400mg sodium / 100g
  }

  if (conditions.includes('kidney_disease')) {
    whereClauses.push("sodium_100g IS NOT NULL AND sodium_100g <= ?");
    params.push(0.40);
    whereClauses.push("(potassium_100g IS NULL OR potassium_100g <= ?)");
    params.push(0.25); // 250mg potassium / 100g
  }

  if (conditions.includes('heart_disease') || conditions.includes('high_cholesterol')) {
    whereClauses.push("sat_fat_100g IS NOT NULL AND sat_fat_100g <= ?");
    params.push(3.0); // 3g saturated fat / 100g
  }

  // Parameterized Hard Allergen Filters (SQL Level)
  allergens.forEach(allergen => {
    const term = `%${allergen.toLowerCase()}%`;
    whereClauses.push("(allergens_tags NOT LIKE ? AND traces_tags NOT LIKE ?)");
    params.push(term, term);
  });

  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT rowid AS id, product_name, ingredients_en, allergens_tags, additives_tags,
           traces_tags, sodium_100g, sugars_100g, sat_fat_100g, cholesterol_100g, potassium_100g
    FROM ingredients_library
    WHERE ${whereClauses.join(' AND ')}
    LIMIT ? OFFSET ?
  `;

  try {
    const rows = (await db.getAllAsync(sql, params)) as any[];
    return rows.map(r => ({
      id: r.id,
      product_name: cleanProductName(r.product_name),
      ingredients_en: r.ingredients_en || '',
      allergens_tags: parseJsonField(r.allergens_tags),
      additives_tags: parseJsonField(r.additives_tags),
      traces_tags: parseJsonField(r.traces_tags),
      sodium_100g: r.sodium_100g,
      sugars_100g: r.sugars_100g,
      sat_fat_100g: r.sat_fat_100g,
      cholesterol_100g: r.cholesterol_100g,
      potassium_100g: r.potassium_100g,
    }));
  } catch (err) {
    console.error('[PackedFoodService] Error running parameterized candidate query:', err);
    return [];
  }
};

/**
 * High-level service: queries candidates from SQLite and runs them through the health engine.
 */
export const getRecommendedPackedFoods = async (
  conditions: HealthCondition[],
  allergens: Allergen[],
  seed: number = 0,
  limit: number = 6
): Promise<RecommendedItem[]> => {
  // Use seed to compute a deterministic candidate window offset
  const offset = (Math.abs(seed) % 15) * limit;
  const candidates = await queryCandidatePackedFoods(conditions, allergens, 40, offset);

  // If initial window returns too few, retry with offset 0
  let finalCandidates = candidates;
  if (candidates.length < limit && offset !== 0) {
    const fallbackCandidates = await queryCandidatePackedFoods(conditions, allergens, 40, 0);
    finalCandidates = fallbackCandidates;
  }

  return recommendPackedFoods(finalCandidates, conditions, allergens, seed, limit);
};

