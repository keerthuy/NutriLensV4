/**
 * useRecommendations Hook
 * 
 * Provides dynamic, health-aware food recommendations (Vegetables, Fruits, Packed Foods)
 * tailored to the ACTIVE member's conditions and allergens.
 * 
 * Features:
 * - Deterministic daily rotation (same member + same day = identical list)
 * - Pull-to-refresh reshuffling within the qualifying pool
 * - In-memory caching keyed by member id + conditions hash + date seed
 * - Dynamic invalidation and recomputation whenever activeProfile changes
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { HealthCondition, Allergen } from '../services/nutrilens_health_rules';
import {
  RecommendedItem,
  RecommendationEngineOutput,
  getDateSeed,
  getRecommendations,
} from '../services/recommendationEngine';
import { getRecommendedPackedFoods } from '../services/packedFoodService';

// In-memory cache keyed by memberId + conditions + allergens + seed
const memoryCache = new Map<string, RecommendationEngineOutput>();

/**
 * Extracts and maps typed conditions and allergens from an active profile object.
 * Accommodates object maps, arrays, and legacy comma-separated strings.
 */
export const extractConditionsAndAllergens = (
  profile: any
): { conditions: HealthCondition[]; allergens: Allergen[] } => {
  if (!profile) {
    return { conditions: [], allergens: [] };
  }

  // 1. Conditions Mapping
  const conditionsSet = new Set<HealthCondition>();
  const rawConditions = profile.medicalConditions;

  if (rawConditions && typeof rawConditions === 'object' && !Array.isArray(rawConditions)) {
    if (rawConditions.diabetes) conditionsSet.add('diabetes');
    if (rawConditions.highBloodPressure || rawConditions.high_blood_pressure) conditionsSet.add('high_blood_pressure');
    if (rawConditions.heartDisease || rawConditions.heart_disease) conditionsSet.add('heart_disease');
    if (rawConditions.kidneyDisease || rawConditions.kidney_disease) conditionsSet.add('kidney_disease');
    if (rawConditions.highCholesterol || rawConditions.high_cholesterol) conditionsSet.add('high_cholesterol');
  } else if (Array.isArray(rawConditions)) {
    rawConditions.forEach((item: unknown) => {
      const s = String(item).trim().toLowerCase().replace(/\s+/g, '_');
      if (s === 'diabetes') conditionsSet.add('diabetes');
      if (s === 'high_blood_pressure' || s === 'highbloodpressure') conditionsSet.add('high_blood_pressure');
      if (s === 'heart_disease' || s === 'heartdisease') conditionsSet.add('heart_disease');
      if (s === 'kidney_disease' || s === 'kidneydisease') conditionsSet.add('kidney_disease');
      if (s === 'high_cholesterol' || s === 'highcholesterol') conditionsSet.add('high_cholesterol');
    });
  } else if (typeof rawConditions === 'string') {
    const lower = rawConditions.toLowerCase();
    if (lower.includes('diabetes')) conditionsSet.add('diabetes');
    if (lower.includes('high blood pressure') || lower.includes('blood_pressure') || lower.includes('hypertension')) {
      conditionsSet.add('high_blood_pressure');
    }
    if (lower.includes('heart disease') || lower.includes('heart_disease')) conditionsSet.add('heart_disease');
    if (lower.includes('kidney disease') || lower.includes('kidney_disease') || lower.includes('renal')) {
      conditionsSet.add('kidney_disease');
    }
    if (lower.includes('cholesterol')) conditionsSet.add('high_cholesterol');
  }

  // 2. Allergens Mapping
  const allergensSet = new Set<Allergen>();
  const rawAllergens = profile.allergies;

  const validAllergens: Record<string, Allergen> = {
    dairy: 'dairy',
    milk: 'dairy',
    egg: 'egg',
    eggs: 'egg',
    tree_nuts: 'tree_nuts',
    tree_nut: 'tree_nuts',
    nuts: 'tree_nuts',
    fish: 'fish',
    gluten: 'gluten',
    wheat: 'wheat',
    sesame: 'sesame',
    seafood: 'seafood',
    shellfish: 'seafood',
    peanut: 'peanuts',
    peanuts: 'peanuts',
    soy: 'soy',
    soya: 'soy',
  };

  const parseAllergenToken = (token: string) => {
    const normalized = token.trim().toLowerCase().replace(/\s+/g, '_');
    if (validAllergens[normalized]) {
      allergensSet.add(validAllergens[normalized]);
    }
  };

  if (Array.isArray(rawAllergens)) {
    rawAllergens.forEach((a: unknown) => parseAllergenToken(String(a)));
  } else if (typeof rawAllergens === 'string') {
    rawAllergens.split(',').forEach(parseAllergenToken);
  }

  return {
    conditions: Array.from(conditionsSet),
    allergens: Array.from(allergensSet),
  };
};

export interface UseRecommendationsResult {
  vegetables: RecommendedItem[];
  fruits: RecommendedItem[];
  packedFoods: RecommendedItem[];
  conditions: HealthCondition[];
  allergens: Allergen[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  activeMemberName: string;
}

export const useRecommendations = (): UseRecommendationsResult => {
  const { activeProfile, userProfile, user } = useAuth();

  const [vegetables, setVegetables] = useState<RecommendedItem[]>([]);
  const [fruits, setFruits] = useState<RecommendedItem[]>([]);
  const [packedFoods, setPackedFoods] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  // Active member profile resolution
  const currentProfile = activeProfile || userProfile;
  const memberId = currentProfile?.id || user?.uid || 'guest';
  const activeMemberName = currentProfile?.fullName || currentProfile?.name || 'You';

  // Extract memoized conditions and allergens
  const { conditions, allergens } = useMemo(() => {
    return extractConditionsAndAllergens(currentProfile);
  }, [currentProfile]);

  const baseDateSeed = useMemo(() => getDateSeed(), []);
  const effectiveSeed = useMemo(() => baseDateSeed + refreshNonce * 1013, [baseDateSeed, refreshNonce]);

  // Unique cache key
  const cacheKey = useMemo(() => {
    const cKey = [...conditions].sort().join(',');
    const aKey = [...allergens].sort().join(',');
    return `${memberId}_c[${cKey}]_a[${aKey}]_s[${effectiveSeed}]`;
  }, [memberId, conditions, allergens, effectiveSeed]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchRecommendations = useCallback(
    async (isPullToRefresh = false) => {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        // Check in-memory cache
        if (memoryCache.has(cacheKey) && !isPullToRefresh) {
          const cached = memoryCache.get(cacheKey)!;
          if (isMountedRef.current) {
            setVegetables(cached.vegetables);
            setFruits(cached.fruits);
            setPackedFoods(cached.packedFoods);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }

        // 1. Synchronously compute produce recommendations (offline, instant)
        const produceResult = getRecommendations({
          conditions,
          allergens,
          seed: effectiveSeed,
          limit: 6,
        });

        if (isMountedRef.current) {
          setVegetables(produceResult.vegetables);
          setFruits(produceResult.fruits);
        }

        // 2. Query SQLite packed foods asynchronously
        let packedRecommendations: RecommendedItem[] = [];
        try {
          packedRecommendations = await getRecommendedPackedFoods(
            conditions,
            allergens,
            effectiveSeed,
            6
          );
        } catch (sqliteErr) {
          console.warn('[useRecommendations] Packed food query warning:', sqliteErr);
          packedRecommendations = [];
        }

        const completeOutput: RecommendationEngineOutput = {
          vegetables: produceResult.vegetables,
          fruits: produceResult.fruits,
          packedFoods: packedRecommendations,
        };

        // Cache completed output
        memoryCache.set(cacheKey, completeOutput);

        if (isMountedRef.current) {
          setPackedFoods(packedRecommendations);
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err: unknown) {
        console.error('[useRecommendations] Error computing recommendations:', err);
        if (isMountedRef.current) {
          setError('Unable to load recommendations at this time.');
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheKey, conditions, allergens, effectiveSeed]
  );

  // Recompute whenever member or health conditions change
  useEffect(() => {
    fetchRecommendations(false);
  }, [fetchRecommendations]);

  // Pull-to-refresh handler: increments refresh nonce to reshuffle within pool
  const refresh = useCallback(async () => {
    setRefreshNonce(prev => prev + 1);
  }, []);

  return {
    vegetables,
    fruits,
    packedFoods,
    conditions,
    allergens,
    loading,
    refreshing,
    error,
    refresh,
    activeMemberName,
  };
};

