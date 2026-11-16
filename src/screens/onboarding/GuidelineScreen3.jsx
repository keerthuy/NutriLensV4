import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { typography } from '../../utils/typography';
import { Ionicons } from '@expo/vector-icons';
import { wp, hp, fs, SCREEN_WIDTH } from '../../utils/responsive';

const GuidelineScreen3 = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#EBF4EC" />

      {/* Image wrapper — white background for clean diagram display */}
      <View style={styles.imageWrapper}>
        <Image
          source={require('../../assets/images/guideline3.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        {/* Step dots */}
        <View style={styles.dotsRow}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <Text style={styles.titleText}>
          Get clear, colour-coded safety scores and instant warnings for
          potential allergens or dietary triggers.
        </Text>

        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('TermsAndConditionsScreen')}
        >
          <Ionicons name="checkmark" size={fs(24)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF4EC',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: hp(60),
    overflow: 'hidden',
    borderBottomLeftRadius: wp(10),
    borderBottomRightRadius: wp(10),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH * 0.85,
    height: hp(58),
  },

  bottomCard: {
    flex: 1,
    paddingHorizontal: wp(7),
    paddingTop: hp(3),
    paddingBottom: hp(4),
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  dot: {
    width: wp(2),
    height: wp(2),
    borderRadius: wp(1),
    backgroundColor: '#B2DFDB',
  },
  dotActive: {
    width: wp(5),
    backgroundColor: '#2ecc71',
    borderRadius: wp(2),
  },
  titleText: {
    fontFamily: typography.fonts.extraBold,
    fontSize: fs(20),
    color: '#1a1a1a',
    lineHeight: fs(20) * 1.55,
    textAlign: 'center',
  },
  nextButton: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: '#2ecc71',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default GuidelineScreen3;