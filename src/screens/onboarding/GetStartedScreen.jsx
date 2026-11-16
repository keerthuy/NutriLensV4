import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import SafeAreaWrapper from '../../components/common/SafeAreaWrapper';
import Button from '../../components/common/Button';
import { colors } from '../../utils/colors';
import { typography } from '../../utils/typography';
import { wp, hp, fs, SCREEN_WIDTH } from '../../utils/responsive';

const GetStartedScreen = ({ navigation }) => {
  return (
    <SafeAreaWrapper backgroundColor="#E8F5E9">
      <View style={styles.container}>

        {/* Top Section - Illustration */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/images/onboarding-illustration.png')}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Middle Section - Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.description}>
            Welcome to NutriLens! Take control of your well-being with the power of AI-driven food analysis. Simply scan any meal, ingredient, or "barcode" to instantly uncover its nutritional breakdown and verify if it's safe for your personal dietary needs, allergies, and health goals. We're here to make smart, personalized nutrition effortless so you can eat with confidence.
          </Text>
        </View>

        {/* Bottom Section - Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate('Guideline1')}
            variant="primary"
          />
          <Button
            title="Log In"
            onPress={() => navigation.navigate('LoginScreen')}
            variant="outline"
          />
        </View>

      </View>
    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: hp(48),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustration: {
    width: SCREEN_WIDTH,
    height: hp(48),
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: wp(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(14.5),
    color: colors.textPrimary,
    lineHeight: fs(14.5) * 1.55,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: wp(6),
    paddingBottom: hp(3),
    gap: hp(1.5),
  },
});

export default GetStartedScreen;