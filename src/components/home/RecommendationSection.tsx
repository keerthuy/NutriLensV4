/**
 * RecommendationSection Component
 * 
 * Renders dynamic, health-aware food recommendations on the NutriLens Home Screen:
 * 1. Recommended Vegetables
 * 2. Recommended Fruits
 * 3. Recommended Packed Foods
 * 
 * Features:
 * - Horizontal scrolling item cards with item-relevant contextual food icons
 * - Dedicated packed goods UI styling & badges (e.g. PACKAGED label, quick nutrient chips)
 * - Plain-language clinical reasons & suitability score badges
 * - Condition badges & "Limit / Avoid" caution tags
 * - Interactive detail modal with comprehensive nutritional breakdown & ingredients preview
 * - Loading skeletons, empty state, and error state with retry
 * - Medical disclaimer footer
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RecommendedItem } from '../../services/recommendationEngine';
import { HealthCondition, Allergen } from '../../services/nutrilens_health_rules';
import { typography } from '../../utils/typography';
import { colors } from '../../utils/colors';
import { wp, hp, fs } from '../../utils/responsive';

interface RecommendationSectionProps {
  vegetables: RecommendedItem[];
  fruits: RecommendedItem[];
  packedFoods: RecommendedItem[];
  conditions: HealthCondition[];
  allergens: Allergen[];
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  navigation?: any;
  activeMemberName?: string;
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  vegetables,
  fruits,
  packedFoods,
  conditions,
  allergens,
  loading,
  error,
  onRefresh,
  navigation,
  activeMemberName = 'You',
}) => {
  const [selectedItem, setSelectedItem] = useState<RecommendedItem | null>(null);

  const formatConditionName = (cond: string) => {
    switch (cond) {
      case 'diabetes':
        return 'Diabetes';
      case 'high_blood_pressure':
        return 'High BP';
      case 'heart_disease':
        return 'Heart';
      case 'kidney_disease':
        return 'Kidney';
      case 'high_cholesterol':
        return 'Cholesterol';
      default:
        return cond.replace(/_/g, ' ');
    }
  };

  const handleCardPress = (item: RecommendedItem) => {
    setSelectedItem(item);
  };

  const handlePackedFoodAction = (item: RecommendedItem) => {
    setSelectedItem(null);
    if (navigation?.navigate) {
      navigation.navigate('ScanTab', { candidateId: item.id, candidateName: item.name });
    }
  };

  // Loading Skeletons
  if (loading && vegetables.length === 0 && fruits.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.mainTitle}>Recommended for {activeMemberName}</Text>
            <Text style={styles.subtitle}>Curating health-safe recommendations...</Text>
          </View>
        </View>
        <View style={styles.skeletonRow}>
          {[1, 2, 3].map(key => (
            <View key={key} style={styles.skeletonCard}>
              <View style={styles.skeletonCircle} />
              <View style={styles.skeletonLineShort} />
              <View style={styles.skeletonLineLong} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Error State
  if (error && vegetables.length === 0 && fruits.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={fs(32)} color={colors.warningOrange} />
        <Text style={styles.errorText}>{error}</Text>
        {onRefresh && (
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.8}>
            <Feather name="refresh-cw" size={fs(14)} color="#FFFFFF" style={{ marginRight: wp(1.5) }} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const renderHorizontalCards = (items: RecommendedItem[], emptyMessage: string) => {
    if (!items || items.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Feather name="info" size={fs(18)} color="#888" style={{ marginRight: wp(2) }} />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsScrollContainer}
      >
        {items.map(item => {
          const hasCaution = item.cautions && item.cautions.length > 0;
          const isPacked = item.category === 'packed_food';

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, isPacked && styles.cardPacked]}
              activeOpacity={0.85}
              onPress={() => handleCardPress(item)}
            >
              {/* Card Header: Product-Relevant Emoji & Score Badge */}
              <View style={styles.cardTopRow}>
                <View style={[styles.emojiCircle, isPacked && styles.emojiCirclePacked]}>
                  <Text style={styles.emojiText}>{item.emoji || (isPacked ? '🍱' : '🥗')}</Text>
                </View>
                <View style={[styles.suitabilityBadge, isPacked && styles.suitabilityBadgePacked]}>
                  <Text style={[styles.suitabilityText, isPacked && styles.suitabilityTextPacked]}>
                    {item.suitabilityScore}%
                  </Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>

              {/* Packaged Food Pill Tag */}
              {isPacked && (
                <View style={styles.packagedTypePill}>
                  <Feather name="package" size={fs(9)} color="#00796B" style={{ marginRight: 3 }} />
                  <Text style={styles.packagedTypePillText}>PACKAGED FOOD</Text>
                </View>
              )}

              {/* 1-Line Primary Reason */}
              <Text style={styles.cardReason} numberOfLines={2}>
                {item.reasons[0] || 'Safe based on your active health profile.'}
              </Text>

              {/* Quick Packed Nutrient Snippet */}
              {isPacked && item.nutrients && (
                <View style={styles.quickNutrientRow}>
                  {item.nutrients.sugar_g !== undefined && item.nutrients.sugar_g <= 5 && (
                    <View style={styles.quickNutrientChip}>
                      <Text style={styles.quickNutrientChipText}>Low Sugar</Text>
                    </View>
                  )}
                  {item.nutrients.sodium_mg !== undefined && item.nutrients.sodium_mg <= 120 && (
                    <View style={styles.quickNutrientChip}>
                      <Text style={styles.quickNutrientChipText}>Low Sodium</Text>
                    </View>
                  )}
                  {item.nutrients.saturatedFat_g !== undefined && item.nutrients.saturatedFat_g <= 1.5 && (
                    <View style={styles.quickNutrientChip}>
                      <Text style={styles.quickNutrientChipText}>Low Sat Fat</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Condition Badges */}
              <View style={styles.badgeRow}>
                {item.conditionsSatisfied.slice(0, 2).map(cond => (
                  <View key={cond} style={styles.conditionChip}>
                    <Text style={styles.conditionChipText}>{formatConditionName(cond)}</Text>
                  </View>
                ))}
              </View>

              {/* Limit / Avoid Caution Tag */}
              {hasCaution && (
                <View style={styles.cautionTag}>
                  <Feather name="alert-triangle" size={fs(11)} color="#D9534F" style={{ marginRight: 3 }} />
                  <Text style={styles.cautionTagText} numberOfLines={1}>
                    Limit portion
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleWithIcon}>
            <Text style={styles.mainTitle}>Recommended for {activeMemberName}</Text>
            <View style={styles.healthDot} />
          </View>
          <Text style={styles.subtitle}>
            {conditions.length > 0
              ? `Personalized for: ${conditions.map(formatConditionName).join(', ')}`
              : 'Nutrient-rich picks for overall health and wellness.'}
          </Text>
        </View>
        {onRefresh && (
          <TouchableOpacity style={styles.iconButton} onPress={onRefresh} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={fs(16)} color="#009933" />
          </TouchableOpacity>
        )}
      </View>

      {/* Allergen Protection Pill */}
      {allergens.length > 0 && (
        <View style={styles.allergenAlertBanner}>
          <Feather name="shield" size={fs(14)} color="#009933" style={{ marginRight: wp(1.5) }} />
          <Text style={styles.allergenAlertText} numberOfLines={1}>
            Filtered: 0% {allergens.join(', ')} (Allergen-safe)
          </Text>
        </View>
      )}

      {/* 1. Recommended Vegetables */}
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryIcon}>🥦</Text>
          <Text style={styles.categoryTitle}>Recommended Vegetables</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{vegetables.length}</Text>
          </View>
        </View>
        {renderHorizontalCards(vegetables, 'No vegetables met your combined filter criteria.')}
      </View>

      {/* 2. Recommended Fruits */}
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryIcon}>🍎</Text>
          <Text style={styles.categoryTitle}>Recommended Fruits</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{fruits.length}</Text>
          </View>
        </View>
        {renderHorizontalCards(fruits, 'No fruits met your combined filter criteria.')}
      </View>

      {/* 3. Recommended Packed Foods */}
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryIcon}>🛒</Text>
          <Text style={styles.categoryTitle}>Recommended Packed Foods</Text>
          <View style={[styles.countBadge, styles.countBadgePacked]}>
            <Text style={[styles.countBadgeText, styles.countBadgeTextPacked]}>{packedFoods.length}</Text>
          </View>
        </View>
        {renderHorizontalCards(packedFoods, 'No packaged items verified safe under current conditions.')}
      </View>

      {/* Medical Guidance Footer */}
      <View style={styles.disclaimerContainer}>
        <Feather name="info" size={fs(14)} color="#757575" style={styles.disclaimerIcon} />
        <Text style={styles.disclaimerText}>
          General guidance only, not medical advice. Consult your doctor or dietitian.
        </Text>
      </View>

      {/* Interactive Detail Modal / Bottom Sheet */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setSelectedItem(null)}
          />
          <View style={styles.modalContent}>
            {/* Modal Drag Bar */}
            <View style={styles.modalDragHandle} />

            {selectedItem && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderInfo}>
                    <View style={[
                      styles.modalEmojiBox,
                      selectedItem.category === 'packed_food' && styles.modalEmojiBoxPacked
                    ]}>
                      <Text style={styles.modalEmoji}>{selectedItem.emoji || (selectedItem.category === 'packed_food' ? '🍱' : '🥗')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{selectedItem.name}</Text>
                      <View style={styles.modalCategoryRow}>
                        <View style={[
                          styles.modalCategoryPill,
                          selectedItem.category === 'packed_food' && styles.modalCategoryPillPacked
                        ]}>
                          <Feather
                            name={selectedItem.category === 'packed_food' ? 'package' : 'feather'}
                            size={fs(11)}
                            color={selectedItem.category === 'packed_food' ? '#00796B' : '#009933'}
                            style={{ marginRight: 3 }}
                          />
                          <Text style={[
                            styles.modalCategoryLabel,
                            selectedItem.category === 'packed_food' && { color: '#00796B' }
                          ]}>
                            {selectedItem.category === 'packed_food'
                              ? 'Packaged Food'
                              : selectedItem.category === 'fruit'
                              ? 'Fresh Fruit'
                              : 'Fresh Vegetable'}
                          </Text>
                        </View>
                        <View style={[
                          styles.modalScoreBadge,
                          selectedItem.category === 'packed_food' && styles.modalScoreBadgePacked
                        ]}>
                          <Text style={[
                            styles.modalScoreText,
                            selectedItem.category === 'packed_food' && styles.modalScoreTextPacked
                          ]}>
                            {selectedItem.suitabilityScore}% Match
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setSelectedItem(null)}
                  >
                    <Feather name="x" size={fs(20)} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
                  {/* Reasons Section */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Why it's recommended for you</Text>
                    {selectedItem.reasons.map((reason, idx) => (
                      <View key={idx} style={styles.modalReasonRow}>
                        <Feather name="check" size={fs(15)} color="#009933" style={styles.checkIcon} />
                        <Text style={styles.modalReasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Ingredients Preview for Packed Goods */}
                  {selectedItem.category === 'packed_food' && selectedItem.ingredientsSnippet && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Ingredients Preview</Text>
                      <View style={styles.ingredientsBox}>
                        <Feather name="list" size={fs(13)} color="#00796B" style={{ marginRight: wp(1.5), marginTop: 2 }} />
                        <Text style={styles.ingredientsText} numberOfLines={3}>
                          {selectedItem.ingredientsSnippet}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Nutritional Highlights */}
                  {selectedItem.nutrients && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Nutritional Profile (per 100g)</Text>
                      <View style={styles.nutrientGrid}>
                        {selectedItem.nutrients.sugar_g !== undefined && (
                          <View style={styles.nutrientPill}>
                            <Text style={styles.nutrientLabel}>Sugar</Text>
                            <Text style={styles.nutrientVal}>{selectedItem.nutrients.sugar_g}g</Text>
                          </View>
                        )}
                        {selectedItem.nutrients.fiber_g !== undefined && (
                          <View style={styles.nutrientPill}>
                            <Text style={styles.nutrientLabel}>Fiber</Text>
                            <Text style={styles.nutrientVal}>{selectedItem.nutrients.fiber_g}g</Text>
                          </View>
                        )}
                        {selectedItem.nutrients.sodium_mg !== undefined && (
                          <View style={styles.nutrientPill}>
                            <Text style={styles.nutrientLabel}>Sodium</Text>
                            <Text style={styles.nutrientVal}>{selectedItem.nutrients.sodium_mg}mg</Text>
                          </View>
                        )}
                        {selectedItem.nutrients.potassium_mg !== undefined && (
                          <View style={styles.nutrientPill}>
                            <Text style={styles.nutrientLabel}>Potassium</Text>
                            <Text style={styles.nutrientVal}>{selectedItem.nutrients.potassium_mg}mg</Text>
                          </View>
                        )}
                        {selectedItem.nutrients.saturatedFat_g !== undefined && (
                          <View style={styles.nutrientPill}>
                            <Text style={styles.nutrientLabel}>Sat. Fat</Text>
                            <Text style={styles.nutrientVal}>{selectedItem.nutrients.saturatedFat_g}g</Text>
                          </View>
                        )}
                        {selectedItem.glycemicIndex && (
                          <View style={styles.nutrientPill}>
                            <Text style={styles.nutrientLabel}>GI Rating</Text>
                            <Text style={[styles.nutrientVal, { textTransform: 'capitalize' }]}>
                              {selectedItem.glycemicIndex}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Cautions */}
                  {selectedItem.cautions.length > 0 && (
                    <View style={styles.cautionSection}>
                      <Text style={styles.cautionSectionTitle}>Precautions & Dietary Advice</Text>
                      {selectedItem.cautions.map((caution, idx) => (
                        <View key={idx} style={styles.cautionRow}>
                          <Feather name="alert-triangle" size={fs(14)} color="#C0392B" style={{ marginRight: wp(2), marginTop: 2 }} />
                          <Text style={styles.cautionText}>{caution}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Packed Food Evaluation Action */}
                  {selectedItem.category === 'packed_food' && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      activeOpacity={0.8}
                      onPress={() => handlePackedFoodAction(selectedItem)}
                    >
                      <Feather name="shield" size={fs(16)} color="#FFFFFF" style={{ marginRight: wp(2) }} />
                      <Text style={styles.actionButtonText}>View Full Safety Evaluation</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: hp(1.5),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp(1.2),
  },
  headerLeft: {
    flex: 1,
    paddingRight: wp(2),
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  mainTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(19),
    color: '#1A1A1A',
  },
  healthDot: {
    width: wp(2.2),
    height: wp(2.2),
    borderRadius: wp(1.1),
    backgroundColor: '#009933',
  },
  subtitle: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(12),
    color: '#666666',
    marginTop: hp(0.3),
  },
  iconButton: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allergenAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF8EE',
    borderRadius: wp(3),
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  allergenAlertText: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(11),
    color: '#009933',
    flex: 1,
  },
  categorySection: {
    marginBottom: hp(2),
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  categoryIcon: {
    fontSize: fs(18),
    marginRight: wp(1.5),
  },
  categoryTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(15),
    color: '#212121',
  },
  countBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.2),
    borderRadius: wp(2.5),
    marginLeft: wp(2),
  },
  countBadgePacked: {
    backgroundColor: '#E0F2F1',
  },
  countBadgeText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(11),
    color: '#009933',
  },
  countBadgeTextPacked: {
    color: '#00796B',
  },
  cardsScrollContainer: {
    paddingRight: wp(4),
    gap: wp(3),
  },
  card: {
    width: wp(42),
    backgroundColor: '#FFFFFF',
    borderRadius: wp(4.5),
    padding: wp(3.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardPacked: {
    borderColor: '#E0F2F1',
    backgroundColor: '#FCFDFC',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  emojiCircle: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#F4F9F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiCirclePacked: {
    backgroundColor: '#E0F2F1',
  },
  emojiText: {
    fontSize: fs(22),
  },
  suitabilityBadge: {
    backgroundColor: '#E2F6E8',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.4),
    borderRadius: wp(2.5),
  },
  suitabilityBadgePacked: {
    backgroundColor: '#E0F2F1',
  },
  suitabilityText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(10),
    color: '#009933',
  },
  suitabilityTextPacked: {
    color: '#00796B',
  },
  cardTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(14),
    color: '#1A1A1A',
    marginBottom: hp(0.3),
  },
  packagedTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
    alignSelf: 'flex-start',
    paddingHorizontal: wp(1.8),
    paddingVertical: hp(0.2),
    borderRadius: wp(1.5),
    marginBottom: hp(0.6),
  },
  packagedTypePillText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(8.5),
    color: '#00796B',
    letterSpacing: 0.3,
  },
  cardReason: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(11),
    color: '#555555',
    lineHeight: fs(15),
    minHeight: hp(3.8),
    marginBottom: hp(0.6),
  },
  quickNutrientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(1),
    marginBottom: hp(0.6),
  },
  quickNutrientChip: {
    backgroundColor: '#F0F9F5',
    paddingHorizontal: wp(1.6),
    paddingVertical: hp(0.25),
    borderRadius: wp(1.5),
    borderWidth: 0.5,
    borderColor: '#C8E6C9',
  },
  quickNutrientChipText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(8.5),
    color: '#2E7D32',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(1),
    marginBottom: hp(0.5),
  },
  conditionChip: {
    backgroundColor: '#EEF5EE',
    paddingHorizontal: wp(1.8),
    paddingVertical: hp(0.3),
    borderRadius: wp(2),
  },
  conditionChipText: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(9),
    color: '#2E7D32',
  },
  cautionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    paddingHorizontal: wp(1.5),
    paddingVertical: hp(0.3),
    borderRadius: wp(2),
    marginTop: hp(0.4),
  },
  cautionTagText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(9),
    color: '#C0392B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(4),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  emptyText: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(12),
    color: '#757575',
    flex: 1,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(2),
    marginTop: hp(0.5),
    marginBottom: hp(2),
  },
  disclaimerIcon: {
    marginRight: wp(2),
  },
  disclaimerText: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(11),
    color: '#757575',
    flex: 1,
    lineHeight: fs(15),
  },
  // Skeleton Styles
  skeletonRow: {
    flexDirection: 'row',
    gap: wp(3),
    marginVertical: hp(1),
  },
  skeletonCard: {
    width: wp(38),
    height: hp(18),
    backgroundColor: '#FFFFFF',
    borderRadius: wp(4),
    padding: wp(3),
  },
  skeletonCircle: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#EAEAEA',
    marginBottom: hp(1.5),
  },
  skeletonLineShort: {
    width: '60%',
    height: hp(1.5),
    backgroundColor: '#EAEAEA',
    borderRadius: wp(1),
    marginBottom: hp(1),
  },
  skeletonLineLong: {
    width: '90%',
    height: hp(1.2),
    backgroundColor: '#EAEAEA',
    borderRadius: wp(1),
  },
  // Error Styles
  errorContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(4),
    padding: wp(5),
    alignItems: 'center',
    marginVertical: hp(2),
  },
  errorText: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(13),
    color: '#666666',
    marginVertical: hp(1),
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#009933',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(3),
  },
  retryButtonText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(12),
    color: '#FFFFFF',
  },
  // Modal / Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: wp(7),
    borderTopRightRadius: wp(7),
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
    paddingBottom: hp(4),
    maxHeight: hp(75),
  },
  modalDragHandle: {
    width: wp(12),
    height: hp(0.6),
    backgroundColor: '#DDD',
    borderRadius: wp(1),
    alignSelf: 'center',
    marginBottom: hp(1.5),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalEmojiBox: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  modalEmojiBoxPacked: {
    backgroundColor: '#E0F2F1',
  },
  modalEmoji: {
    fontSize: fs(28),
  },
  modalTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(18),
    color: '#1A1A1A',
  },
  modalCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginTop: hp(0.3),
  },
  modalCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF5EE',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: wp(2),
  },
  modalCategoryPillPacked: {
    backgroundColor: '#E0F2F1',
  },
  modalCategoryLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(11),
    color: '#2E7D32',
  },
  modalScoreBadge: {
    backgroundColor: '#E2F6E8',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.2),
    borderRadius: wp(2),
  },
  modalScoreBadgePacked: {
    backgroundColor: '#E0F2F1',
  },
  modalScoreText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(10),
    color: '#009933',
  },
  modalScoreTextPacked: {
    color: '#00796B',
  },
  modalCloseButton: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: wp(2),
  },
  modalScrollBody: {
    marginTop: hp(1.5),
  },
  modalSection: {
    marginBottom: hp(2),
  },
  modalSectionTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(14),
    color: '#212121',
    marginBottom: hp(0.8),
  },
  modalReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp(0.8),
  },
  checkIcon: {
    marginRight: wp(2),
    marginTop: hp(0.3),
  },
  modalReasonText: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(13),
    color: '#444444',
    flex: 1,
    lineHeight: fs(18),
  },
  ingredientsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5FBF9',
    borderRadius: wp(3),
    padding: wp(3),
    borderWidth: 1,
    borderColor: '#E0F2F1',
  },
  ingredientsText: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(12),
    color: '#455A64',
    flex: 1,
    lineHeight: fs(16),
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  nutrientPill: {
    backgroundColor: '#F7F9F7',
    borderRadius: wp(3),
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderWidth: 1,
    borderColor: '#E6ECE6',
    minWidth: wp(20),
  },
  nutrientLabel: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(10),
    color: '#757575',
  },
  nutrientVal: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(13),
    color: '#1A1A1A',
    marginTop: hp(0.2),
  },
  cautionSection: {
    backgroundColor: '#FDEDEC',
    borderRadius: wp(3.5),
    padding: wp(3.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: '#FADBD8',
  },
  cautionSectionTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(13),
    color: '#C0392B',
    marginBottom: hp(0.5),
  },
  cautionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: hp(0.3),
  },
  cautionText: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(12),
    color: '#922B21',
    flex: 1,
    lineHeight: fs(16),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009933',
    borderRadius: wp(3.5),
    paddingVertical: hp(1.4),
    marginTop: hp(1),
    marginBottom: hp(2),
  },
  actionButtonText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(13),
    color: '#FFFFFF',
  },
});

export default RecommendationSection;
