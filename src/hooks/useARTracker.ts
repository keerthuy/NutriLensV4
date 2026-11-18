import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Dimensions } from 'react-native';
import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { OneEuroFilter } from '../utils/oneEuroFilter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function normalizeAngle(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function useARTracker(initialWidth = SCREEN_WIDTH, initialHeight = SCREEN_HEIGHT * 0.40) {
  const [isLocked, setIsLocked] = useState(false);

  // Native animated values for 60 FPS hardware translation
  const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const rollAnim = useRef(new Animated.Value(0)).current;

  // Viewport dimensions reference for calibrated camera FOV projection
  const viewportSizeRef = useRef<{ width: number; height: number }>({
    width: initialWidth,
    height: initialHeight,
  });

  // 1-Euro Filters for X, Y, and Roll (Casiez et al. 2012)
  const xFilterRef = useRef(new OneEuroFilter(1.0, 0.25, 1.0)).current;
  const yFilterRef = useRef(new OneEuroFilter(1.0, 0.25, 1.0)).current;
  const rollFilterRef = useRef(new OneEuroFilter(1.2, 0.20, 1.0)).current;

  // Inertial sensor references for world-space anchoring
  const currentRotationRef = useRef<{ alpha: number; beta: number; gamma: number }>({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const anchorRotationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);

  // Set viewport dimensions dynamically
  const setViewportSize = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) {
      viewportSizeRef.current = { width, height };
    }
  }, []);

  // Lock anchor reference at the current moment of scan confirmation
  const lockAnchor = useCallback(() => {
    anchorRotationRef.current = { ...currentRotationRef.current };
    xFilterRef.reset();
    yFilterRef.reset();
    rollFilterRef.reset();
    panAnim.setValue({ x: 0, y: 0 });
    rollAnim.setValue(0);
    setIsLocked(true);
  }, [panAnim, rollAnim, xFilterRef, yFilterRef, rollFilterRef]);

  // Release/reset anchor
  const clearAnchor = useCallback(() => {
    anchorRotationRef.current = null;
    panAnim.setValue({ x: 0, y: 0 });
    rollAnim.setValue(0);
    setIsLocked(false);
  }, [panAnim, rollAnim]);

  // Subscribe to DeviceMotion sensor (Gyroscope + Accelerometer fusion)
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    const initMotion = async () => {
      try {
        const isAvailable = await DeviceMotion.isAvailableAsync();
        if (isAvailable) {
          DeviceMotion.setUpdateInterval(16); // 60 FPS update rate

          sub = DeviceMotion.addListener((data: DeviceMotionMeasurement) => {
            if (data.rotation) {
              const { alpha, beta, gamma } = data.rotation;
              currentRotationRef.current = { alpha, beta, gamma };

              // If locked onto an object, compensate for phone movement using fused orientation
              if (anchorRotationRef.current) {
                const anchor = anchorRotationRef.current;
                const nowMs = Date.now();

                // 1. Angular differences from the locked reference moment
                const dYaw = normalizeAngle(alpha - anchor.alpha);
                const dPitch = beta - anchor.beta;
                const dRoll = gamma - anchor.gamma;

                // 2. Optical projection for portrait camera:
                // Horizontal FOV ~42 deg -> factor = 1.15 * viewportWidth
                // Vertical FOV ~62 deg -> factor = 0.90 * viewportHeight
                const rawTargetX = -Math.sin(dYaw) * (viewportSizeRef.current.width * 1.15);
                const rawTargetY = Math.sin(dPitch) * (viewportSizeRef.current.height * 0.90);
                const rawTargetRollDeg = -dRoll * (180 / Math.PI);

                // 3. Safety Clamping inside viewport bounds
                const maxDx = viewportSizeRef.current.width * 0.46;
                const maxDy = viewportSizeRef.current.height * 0.46;
                const clampedX = Math.max(-maxDx, Math.min(maxDx, rawTargetX));
                const clampedY = Math.max(-maxDy, Math.min(maxDy, rawTargetY));
                const clampedRoll = Math.max(-60, Math.min(60, rawTargetRollDeg));

                // 4. Casiez 1-Euro Filter: zero jitter at rest, zero lag during motion
                const filteredX = xFilterRef.filter(clampedX, nowMs);
                const filteredY = yFilterRef.filter(clampedY, nowMs);
                const filteredRoll = rollFilterRef.filter(clampedRoll, nowMs);

                // 5. Update native driver directly without React re-renders (Native 60 FPS)
                panAnim.setValue({
                  x: filteredX,
                  y: filteredY,
                });
                rollAnim.setValue(filteredRoll);
              }
            }
          });
        }
      } catch (err) {
        console.warn('[useARTracker] DeviceMotion unavailable or error:', err);
      }
    };

    initMotion();

    return () => {
      if (sub) {
        sub.remove();
      }
    };
  }, [panAnim, rollAnim, xFilterRef, yFilterRef, rollFilterRef]);

  return {
    isLocked,
    panAnim,
    rollAnim,
    setViewportSize,
    lockAnchor,
    clearAnchor,
  };
}
