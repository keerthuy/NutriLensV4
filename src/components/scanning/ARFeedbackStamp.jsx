import React, { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Safely load Skia if available
let Skia = null;
try {
  const skiaPkg = require('@shopify/react-native-skia');
  if (skiaPkg && skiaPkg.Canvas && skiaPkg.Path) {
    Skia = skiaPkg;
  }
} catch (e) {
  Skia = null;
}

/**
 * ARFeedbackStamp
 *
 * Computer-Vision / Sensor Anchored Live AR Feedback Stamp:
 * - Green Tick (✓) when evaluated as SAFE
 * - Red Cross (✗) when evaluated as UNSAFE
 *
 * Tracks the physical object in real time through 6-DoF DeviceMotion pan/roll anims
 * so the stamp glides across the camera preview as the user rotates or moves the phone.
 */
export default function ARFeedbackStamp({
  visible = false,
  isSafe = true,
  panAnim = null,
  rollAnim = null,
  containerWidth = Dimensions.get('window').width,
  containerHeight = 300,
  curvaturePercent = 70,
  size = 110,
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Pop-in spring animation when stamp becomes visible
  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.2);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, isSafe, scaleAnim]);

  if (!visible) return null;

  const targetCenterX = (containerWidth - size) / 2;
  const targetCenterY = (containerHeight - size) / 2;

  const transformStyle = [
    { scale: scaleAnim },
    panAnim ? { translateX: panAnim.x } : { translateX: 0 },
    panAnim ? { translateY: panAnim.y } : { translateY: 0 },
    rollAnim
      ? {
          rotate: rollAnim.interpolate({
            inputRange: [-180, 180],
            outputRange: ['-180deg', '180deg'],
          }),
        }
      : { rotate: '0deg' },
  ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stampRoot,
        {
          left: targetCenterX,
          top: targetCenterY,
          width: size,
          height: size,
          transform: transformStyle,
        },
      ]}
    >
      {Skia ? (
        <SkiaDecalView
          isSafe={isSafe}
          size={size}
          curvaturePercent={curvaturePercent}
        />
      ) : (
        <FallbackDecalView isSafe={isSafe} size={size} />
      )}
    </Animated.View>
  );
}

/**
 * High-performance Skia Canvas Decal View
 */
function SkiaDecalView({ isSafe, size, curvaturePercent }) {
  const { Canvas, Path, RadialGradient, vec, Group, Circle } = Skia;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.40;
  const curveNorm = Math.min(1, Math.max(0, curvaturePercent / 100));

  const accentColor = isSafe ? '#10B981' : '#EF4444';
  const glowColor = isSafe ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)';
  const glyphStrokeColor = isSafe ? '#34D399' : '#F87171';
  const innerRimColor = isSafe ? 'rgba(110, 231, 183, 0.65)' : 'rgba(252, 165, 165, 0.65)';

  // Checkmark `✓` Path
  const checkPath = useMemo(() => {
    const p1 = { x: cx - r * 0.46, y: cy + r * 0.04 };
    const p2 = { x: cx - r * 0.10, y: cy + r * 0.46 };
    const p3 = { x: cx + r * 0.50, y: cy - r * 0.42 };
    const sagitta = 7 * curveNorm;

    const cp1x = (p1.x + p2.x) / 2 - sagitta * 0.25;
    const cp1y = (p1.y + p2.y) / 2 + sagitta * 0.4;
    const cp2x = (p2.x + p3.x) / 2 + sagitta * 0.35;
    const cp2y = (p2.y + p3.y) / 2 - sagitta * 0.6;

    return `M ${p1.x} ${p1.y} Q ${cp1x} ${cp1y} ${p2.x} ${p2.y} Q ${cp2x} ${cp2y} ${p3.x} ${p3.y}`;
  }, [cx, cy, r, curveNorm]);

  // Cross `✗` Paths
  const crossPaths = useMemo(() => {
    const arm = r * 0.42;
    const sagitta = 6 * curveNorm;
    const arm1 = `M ${cx - arm} ${cy - arm} Q ${cx + sagitta} ${cy - sagitta * 0.3} ${cx + arm} ${cy + arm}`;
    const arm2 = `M ${cx + arm} ${cy - arm} Q ${cx - sagitta} ${cy - sagitta * 0.3} ${cx - arm} ${cy + arm}`;
    return { arm1, arm2 };
  }, [cx, cy, r, curveNorm]);

  // Outer & Inner Concentric Glassmorphism Rims
  const outerRim = useMemo(() => {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }, [cx, cy, r]);

  const innerRim = useMemo(() => {
    const ir = r * 0.88;
    return `M ${cx - ir} ${cy} A ${ir} ${ir} 0 1 0 ${cx + ir} ${cy} A ${ir} ${ir} 0 1 0 ${cx - ir} ${cy} Z`;
  }, [cx, cy, r]);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group origin={vec(cx, cy)}>
        {/* Soft Radial Ambient Glow */}
        <Circle cx={cx} cy={cy} r={r * 1.15}>
          <RadialGradient
            c={vec(cx, cy)}
            r={r * 1.15}
            colors={[glowColor, 'rgba(0,0,0,0)']}
          />
        </Circle>

        {/* Translucent Frosted Glass Base */}
        <Circle cx={cx} cy={cy} r={r} color="rgba(15, 23, 42, 0.42)" />

        {/* Outer Circular Rim */}
        <Path
          path={outerRim}
          color={accentColor}
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
        />

        {/* Inner Luminous Rim */}
        <Path
          path={innerRim}
          color={innerRimColor}
          style="stroke"
          strokeWidth={1.2}
          strokeCap="round"
        />

        {/* Dynamic Vector Glyph: Checkmark `✓` or Cross `✗` */}
        {isSafe ? (
          <Path
            path={checkPath}
            color={glyphStrokeColor}
            style="stroke"
            strokeWidth={4.5}
            strokeCap="round"
            strokeJoin="round"
          />
        ) : (
          <Group>
            <Path
              path={crossPaths.arm1}
              color={glyphStrokeColor}
              style="stroke"
              strokeWidth={4.5}
              strokeCap="round"
            />
            <Path
              path={crossPaths.arm2}
              color={glyphStrokeColor}
              style="stroke"
              strokeWidth={4.5}
              strokeCap="round"
            />
          </Group>
        )}
      </Group>
    </Canvas>
  );
}

/**
 * Pure React Native / Feather Vector Fallback
 */
function FallbackDecalView({ isSafe, size }) {
  const accentColor = isSafe ? '#10B981' : '#EF4444';
  const bgColor = isSafe ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)';
  const iconName = isSafe ? 'check' : 'x';

  return (
    <View
      style={[
        styles.fallbackCircle,
        {
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: (size * 0.85) / 2,
          borderColor: accentColor,
          backgroundColor: bgColor,
          shadowColor: accentColor,
        },
      ]}
    >
      <Feather name={iconName} size={size * 0.45} color={accentColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  stampRoot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  fallbackCircle: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
});
