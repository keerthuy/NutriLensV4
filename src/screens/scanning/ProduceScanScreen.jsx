import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { useResizer } from 'react-native-vision-camera-resizer';
import { NitroModules } from 'react-native-nitro-modules';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming } from 'react-native-reanimated';
import { typography } from '../../utils/typography';
import { wp, hp, fs } from '../../utils/responsive';
import { useAuth } from '../../hooks/useAuth';
import { useTFLite } from '../../context/TFLiteContext';
import {
  SUPPORTED_PRODUCE_CLASSES,
  NEW_PRODUCE_MODEL_CLASSES,
  PRODUCE_MODEL_CATALOG,
  evaluateProduceItem,
  getProduceDefaultWeight,
} from '../../services/produceRuleEngine';
import { logProduceCorrection } from '../../services/produceCorrectionLogger';
import { useARTracker } from '../../hooks/useARTracker';
import ARFeedbackStamp from '../../components/scanning/ARFeedbackStamp';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAMERA_HEIGHT = hp(40);

export default function ProduceScanScreen({ navigation }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  const { tfModel } = useTFLite();
  const model = tfModel.state === 'loaded' ? tfModel.model : undefined;
  const { activeProfile } = useAuth();

  // 6-DoF Sensor Motion Tracker for live AR Verdict Decal
  const arTracker = useARTracker(SCREEN_WIDTH, CAMERA_HEIGHT);

  // Hardware GPU Resizer to convert camera frames directly into TRUE 24-bit RGB (416x416 planar)
  const resizer = useResizer({
    width: 416,
    height: 416,
    channelOrder: 'rgb',
    dataType: 'uint8',
    scaleMode: 'contain',
    pixelLayout: 'planar',
  });

  const [torchOn, setTorchOn] = useState(false);
  const [selectedProduceKey, setSelectedProduceKey] = useState('apple');
  const [servingWeight, setServingWeight] = useState(182);
  const [evaluation, setEvaluation] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectedClassIdx, setDetectedClassIdx] = useState(-1);
  const [isLocked, setIsLocked] = useState(false);
  const [topCandidates, setTopCandidates] = useState([]);

  // Confidence Threshold & Auto-Fix on Single High-Accuracy Produce
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.50);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [detectedPrediction, setDetectedPrediction] = useState(null);
  const [correctionToast, setCorrectionToast] = useState(null);
  const highAccuracyStreak = useRef(0);
  const unlockCooldownUntil = useRef(0);

  // Synchronization refs and shared values to avoid stale closures in camera worklet
  const isLockedRef = useRef(false);
  const isConfirmedRef = useRef(false);
  const isLockedShared = useSharedValue(false);

  // Manual browse / search tray
  const [showCatalogList, setShowCatalogList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Animated Bounding Box (Tracks ONLY ONE primary focused produce)
  const boxX = useSharedValue(0);
  const boxY = useSharedValue(0);
  const boxWidth = useSharedValue(0);
  const boxHeight = useSharedValue(0);
  const boxOpacity = useSharedValue(0);
  const lastInferenceTime = useSharedValue(0);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // Evaluate food safety when fixed/confirmed on the single produce item
  useEffect(() => {
    if (isConfirmed && selectedProduceKey) {
      const evalResult = evaluateProduceItem(selectedProduceKey, activeProfile, servingWeight);
      setEvaluation(evalResult);
      arTracker.lockAnchor();
    } else if (!isConfirmed) {
      setEvaluation(null);
      arTracker.clearAnchor();
    }
  }, [isConfirmed, selectedProduceKey, servingWeight, activeProfile]);

  const handleSelectProduce = useCallback((key) => {
    setSelectedProduceKey(key);
    const defaultWt = getProduceDefaultWeight(key);
    setServingWeight(defaultWt);
  }, []);

  const adjustWeight = (delta) => {
    setServingWeight((prev) => Math.max(10, Math.min(1000, prev + delta)));
  };

  // User confirms the detected label or chooses an alternative
  const handleConfirmProduce = async (confirmedKey) => {
    handleSelectProduce(confirmedKey);
    setIsConfirmed(true);
    setIsLocked(true);
    isConfirmedRef.current = true;
    isLockedRef.current = true;
    isLockedShared.value = true;
    highAccuracyStreak.current = 0;
    arTracker.lockAnchor();

    // If the user corrected the label, log it along with the snapshot for future model training!
    const predictedLabel = detectedPrediction?.label || selectedProduceKey;
    if (predictedLabel && confirmedKey !== predictedLabel) {
      let imageUri = null;
      try {
        if (cameraRef.current != null) {
          const photo = await cameraRef.current.takePhoto({
            flash: torchOn ? 'on' : 'off',
            enableShutterSound: false,
          });
          imageUri = photo?.path || null;
        }
      } catch (camErr) {
        console.log('[ProduceScan] takePhoto for correction log skipped:', camErr?.message || camErr);
      }

      await logProduceCorrection({
        imageUri,
        modelPredictedLabel: predictedLabel,
        modelConfidence: detectedPrediction?.conf || (detectionConfidence / 100),
        userCorrectedLabel: confirmedKey,
        topCandidates,
      });

      setCorrectionToast(`Correction logged: "${predictedLabel}" ➔ "${confirmedKey}" 📝`);
      setTimeout(() => setCorrectionToast(null), 4000);
    }
  };

  // Full clean reset for scanning the next produce item
  const handleResetScan = useCallback(() => {
    arTracker.clearAnchor();
    setIsConfirmed(false);
    setIsLocked(false);
    isConfirmedRef.current = false;
    isLockedRef.current = false;
    isLockedShared.value = false;
    setEvaluation(null);
    setDetectionConfidence(0);
    setDetectedPrediction(null);
    setDetectedClassIdx(-1);
    setTopCandidates([]);
    highAccuracyStreak.current = 0;
    unlockCooldownUntil.current = Date.now() + 800; // 800ms window to aim at new object before re-locking
    boxOpacity.value = 0;
    boxWidth.value = 0;
    boxHeight.value = 0;
  }, [boxOpacity, boxWidth, boxHeight, isLockedShared]);

  // Unified Lock / Unlock toggle
  const handleToggleLock = () => {
    if (isLocked || isConfirmed) {
      // UNLOCK: Reset scan cleanly so camera immediately tracks the new produce item
      handleResetScan();
    } else {
      // MANUAL LOCK: Fix on currently centered item
      setIsLocked(true);
      setIsConfirmed(true);
      isLockedRef.current = true;
      isConfirmedRef.current = true;
      isLockedShared.value = true;
      highAccuracyStreak.current = 0;
    }
  };

  const handleLiveDetection = useCallback((pred) => {
    if (isLockedRef.current || isConfirmedRef.current) return;
    if (!pred || pred.conf < 0.50) {
      setDetectionConfidence(0);
      setDetectedPrediction(null);
      setDetectedClassIdx(-1);
      setTopCandidates([]);
      highAccuracyStreak.current = 0;
      boxOpacity.value = 0;
      return;
    }

    const { label, conf, candidates, classIdx } = pred;
    setDetectedPrediction(pred);
    const confPct = Math.round(conf * 100);
    setDetectionConfidence(confPct);

    if (typeof classIdx === 'number') {
      setDetectedClassIdx(classIdx);
    }
    const validCandidates = (candidates || []).filter((c) => c.score >= 50);
    setTopCandidates(validCandidates);

    if (label && label !== selectedProduceKey) {
      handleSelectProduce(label);
    }

    // Auto-Fix on the highest accuracy single produce object:
    // Once confidence is >= 52% and stable (or >= 65% immediate), lock onto it and give results!
    const isCoolingDown = Date.now() < unlockCooldownUntil.current;
    if (conf >= 0.52 && !isCoolingDown) {
      highAccuracyStreak.current += 1;
      if (highAccuracyStreak.current >= 2 || conf >= 0.65) {
        setIsConfirmed(true);
        setIsLocked(true);
        isConfirmedRef.current = true;
        isLockedRef.current = true;
        isLockedShared.value = true;
        highAccuracyStreak.current = 0;
      }
    } else {
      highAccuracyStreak.current = 0;
    }
  }, [selectedProduceKey, handleSelectProduce, isLockedShared, boxOpacity]);

  const boxedModel = useMemo(
    () => (model != null ? NitroModules.box(model) : undefined),
    [model]
  );

  const boxedResizer = useMemo(
    () => (resizer != null && resizer.state === 'ready' && resizer.resizer != null ? NitroModules.box(resizer.resizer) : undefined),
    [resizer]
  );

  const onFrame = useCallback((frame) => {
    'worklet';
    if (frame.width <= 0 || frame.height <= 0) {
      frame.dispose();
      return;
    }

    // Skip inference completely when locked to save GPU/CPU and maintain fixed state
    if (isLockedShared.value) {
      frame.dispose();
      return;
    }

    const actualModel = boxedModel ? boxedModel.unbox() : undefined;
    const actualResizer = boxedResizer ? boxedResizer.unbox() : undefined;
    const now = performance.now();

    // Limit inference to every 250ms for smooth 60fps UI
    if (now - lastInferenceTime.value < 250 || !actualModel) {
      frame.dispose();
      return;
    }
    lastInferenceTime.value = now;

    let gpuFrame = null;
    try {
      if (!globalThis.produceInputBuffer) {
        // Model expects: [1, 3, 416, 416] Float32 = 519,168 floats
        globalThis.produceInputBuffer = new Float32Array(3 * 416 * 416);
      }
      const floatBuffer = globalThis.produceInputBuffer;
      const inv255 = 1.0 / 255.0;

      // Calculate letterbox scaling factors (scaleMode: contain) to undo padding later
      const isRotated = frame.orientation === 'portrait' || frame.orientation === 'portrait-upside-down';
      const frameW = isRotated ? frame.height : frame.width;
      const frameH = isRotated ? frame.width : frame.height;
      const scaleFactor = Math.min(416 / frameW, 416 / frameH);
      const renderedW = frameW * scaleFactor;
      const renderedH = frameH * scaleFactor;
      const normPadX = (416 - renderedW) / (2 * 416);
      const normPadY = (416 - renderedH) / (2 * 416);
      const normScaleX = renderedW / 416;
      const normScaleY = renderedH / 416;

      // 1. Preferred Path: Hardware GPU Resizer (True RGB Color conversion + Letterbox contain)
      if (actualResizer) {
        gpuFrame = actualResizer.resize(frame);
        const buffer = gpuFrame.getPixelBuffer();
        const uintBytes = new Uint8Array(buffer);
        const limit = Math.min(uintBytes.length, floatBuffer.length);
        for (let i = 0; i < limit; i++) {
          floatBuffer[i] = uintBytes[i] * inv255;
        }
      } else {
        // 2. Fallback Path: Full YUV420 to RGB conversion with letterbox padding
        const planes = frame.getPlanes();
        if (planes.length >= 3) {
          const yBytes = new Uint8Array(planes[0].getPixelBuffer());
          const uBytes = new Uint8Array(planes[1].getPixelBuffer());
          const vBytes = new Uint8Array(planes[2].getPixelBuffer());

          const gOffset = 173056; // 416 * 416
          const bOffset = 346112; // 2 * 416 * 416
          floatBuffer.fill(0); // Black letterbox padding

          const padPixelsX = Math.round(normPadX * 416);
          const padPixelsY = Math.round(normPadY * 416);

          for (let y = 0; y < Math.round(renderedH); y++) {
            const destY = padPixelsY + y;
            if (destY >= 416) break;
            const srcY = Math.min(frameH - 1, Math.floor(y / scaleFactor));
            const uvY = Math.floor(srcY / 2);
            const yRow = srcY * frame.width;
            const uvRow = uvY * Math.floor(frame.width / 2);
            const destRow = destY * 416;

            for (let x = 0; x < Math.round(renderedW); x++) {
              const destX = padPixelsX + x;
              if (destX >= 416) break;
              const srcX = Math.min(frameW - 1, Math.floor(x / scaleFactor));
              const uvX = Math.floor(srcX / 2);

              const Y = yBytes[yRow + srcX];
              const U = uBytes[uvRow + uvX] - 128;
              const V = vBytes[uvRow + uvX] - 128;

              // Color formula: ITU-R BT.601
              const R = Math.max(0, Math.min(255, Y + 1.402 * V));
              const G = Math.max(0, Math.min(255, Y - 0.344136 * U - 0.714136 * V));
              const B = Math.max(0, Math.min(255, Y + 1.772 * U));

              const idx = destRow + destX;
              floatBuffer[idx] = R * inv255;
              floatBuffer[gOffset + idx] = G * inv255;
              floatBuffer[bOffset + idx] = B * inv255;
            }
          }
        }
      }

      // Run Model Inference on RGB buffer
      const outputs = actualModel.runSync([floatBuffer.buffer]);
      if (outputs && outputs.length > 0) {
        const outputArray = new Float32Array(outputs[0]);
        const numElements = outputArray.length;

        // Model Output Tensor Shape: [1, 16, 3549] for 12-class model, or [1, 51, 3549] for 47-class model
        if (numElements === 56784 || numElements === 180999 || numElements % 3549 === 0) {
          const numAnchors = 3549;
          const numClasses = numElements === 56784 ? 12 : (numElements === 180999 ? 47 : Math.max(1, Math.round(numElements / numAnchors) - 4));
          const activeClasses = numClasses === 12 ? NEW_PRODUCE_MODEL_CLASSES : SUPPORTED_PRODUCE_CLASSES;
          const candBoxes = [];
          const candScores = [];
          const candClasses = [];
          const classMaxScores = new Float32Array(numClasses);

          for (let i = 0; i < numAnchors; i++) {
            let anchorBestScore = 0;
            let anchorBestClass = -1;

            for (let c = 0; c < numClasses; c++) {
              const rawScore = outputArray[(4 + c) * numAnchors + i];
              // Sigmoid activation for logits
              const score = 1.0 / (1.0 + Math.exp(-Math.max(-50, Math.min(50, rawScore))));

              if (score > classMaxScores[c]) {
                classMaxScores[c] = score;
              }

              if (score > anchorBestScore) {
                anchorBestScore = score;
                anchorBestClass = c;
              }
            }

            // Gather candidate boxes - STRICT >= 50% threshold only (never detect under 50%)
            if (anchorBestScore >= 0.50) {
              let cx = outputArray[i];
              let cy = outputArray[numAnchors + i];
              let w = outputArray[2 * numAnchors + i];
              let h = outputArray[3 * numAnchors + i];

              if (cx > 1.0 || w > 1.0) {
                cx /= 416;
                cy /= 416;
                w /= 416;
                h /= 416;
              }

              // Undo letterbox padding to obtain true normalized coordinates [0, 1]
              const cxUnpad = (cx - normPadX) / normScaleX;
              const cyUnpad = (cy - normPadY) / normScaleY;
              const wUnpad = w / normScaleX;
              const hUnpad = h / normScaleY;

              const x1 = Math.max(0, Math.min(1, cxUnpad - wUnpad / 2));
              const y1 = Math.max(0, Math.min(1, cyUnpad - hUnpad / 2));
              const x2 = Math.max(0, Math.min(1, cxUnpad + wUnpad / 2));
              const y2 = Math.max(0, Math.min(1, cyUnpad + hUnpad / 2));

              candBoxes.push([x1, y1, x2, y2]);
              candScores.push(anchorBestScore);
              candClasses.push(anchorBestClass);
            }
          }

          // Per-Class NMS (IoU threshold 0.45, max 5 detections)
          const keepIndices = [];
          const classGroups = {};
          for (let k = 0; k < candClasses.length; k++) {
            const c = candClasses[k];
            if (!classGroups[c]) classGroups[c] = [];
            classGroups[c].push(k);
          }

          for (const c in classGroups) {
            const idxs = classGroups[c];
            idxs.sort((a, b) => candScores[b] - candScores[a]);

            while (idxs.length > 0) {
              const cur = idxs.shift();
              keepIndices.push(cur);
              if (idxs.length === 0) break;

              const curBox = candBoxes[cur];
              for (let j = idxs.length - 1; j >= 0; j--) {
                const otherIdx = idxs[j];
                const otherBox = candBoxes[otherIdx];

                const xA = Math.max(curBox[0], otherBox[0]);
                const yA = Math.max(curBox[1], otherBox[1]);
                const xB = Math.min(curBox[2], otherBox[2]);
                const yB = Math.min(curBox[3], otherBox[3]);
                const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);

                if (interArea > 0) {
                  const areaA = (curBox[2] - curBox[0]) * (curBox[3] - curBox[1]);
                  const areaB = (otherBox[2] - otherBox[0]) * (otherBox[3] - otherBox[1]);
                  const unionArea = areaA + areaB - interArea;
                  const iou = unionArea > 0 ? interArea / unionArea : 0;
                  if (iou > 0.45) {
                    idxs.splice(j, 1);
                  }
                }
              }
            }
          }

          // Sort final suppressed detections descending by score
          keepIndices.sort((a, b) => candScores[b] - candScores[a]);

          // Collect top candidates - STRICT >= 50% only
          const candidateList = [];
          for (let c = 0; c < numClasses; c++) {
            if (classMaxScores[c] >= 0.50) {
              candidateList.push({
                classIdx: c,
                label: activeClasses[c],
                score: Math.round(classMaxScores[c] * 100),
              });
            }
          }
          candidateList.sort((a, b) => b.score - a.score);

          if (keepIndices.length > 0) {
            // Focus on ONLY ONE single produce object: the one with the highest accuracy centered in the viewfinder
            let bestIdx = keepIndices[0];
            let bestPriorityScore = -1;

            for (let k = 0; k < keepIndices.length; k++) {
              const idx = keepIndices[k];
              const score = candScores[idx];
              const box = candBoxes[idx];
              const midX = (box[0] + box[2]) / 2;
              const midY = (box[1] + box[3]) / 2;
              const distFromCenter = Math.sqrt((midX - 0.5) * (midX - 0.5) + (midY - 0.5) * (midY - 0.5));
              // Weight center candidates higher so background/peripheral items are ignored
              const centerWeight = Math.max(0.5, 1.0 - distFromCenter * 1.0);
              const priorityScore = score * centerWeight;

              if (priorityScore > bestPriorityScore) {
                bestPriorityScore = priorityScore;
                bestIdx = idx;
              }
            }

            const bestScore = candScores[bestIdx];
            const bestClass = candClasses[bestIdx];
            const bestBox = candBoxes[bestIdx];
            const label = activeClasses[bestClass];

            if (bestScore >= 0.50) {
              // Map unpadded frame box [x1, y1, x2, y2] to Camera view (cover mode)
              const viewScale = Math.max(SCREEN_WIDTH / frameW, CAMERA_HEIGHT / frameH);
              const wView = frameW * viewScale;
              const hView = frameH * viewScale;
              const offX = (SCREEN_WIDTH - wView) / 2;
              const offY = (CAMERA_HEIGHT - hView) / 2;

              const screenX1 = bestBox[0] * wView + offX;
              const screenY1 = bestBox[1] * hView + offY;
              const screenX2 = bestBox[2] * wView + offX;
              const screenY2 = bestBox[3] * hView + offY;

              const bLeft = Math.max(0, Math.min(SCREEN_WIDTH - 20, screenX1));
              const bTop = Math.max(0, Math.min(CAMERA_HEIGHT - 20, screenY1));
              const bWidth = Math.max(20, Math.min(SCREEN_WIDTH - bLeft, screenX2 - screenX1));
              const bHeight = Math.max(20, Math.min(CAMERA_HEIGHT - bTop, screenY2 - screenY1));

              boxX.value = bLeft;
              boxY.value = bTop;
              boxWidth.value = bWidth;
              boxHeight.value = bHeight;
              boxOpacity.value = 1;

              runOnJS(handleLiveDetection)({
                label,
                conf: bestScore,
                candidates: candidateList.slice(0, 3),
                classIdx: bestClass,
              });
            } else {
              boxOpacity.value = 0;
              runOnJS(handleLiveDetection)(null);
            }
          } else {
            boxOpacity.value = 0;
            runOnJS(handleLiveDetection)(null);
          }
        }
      }
    } catch (err) {
      console.log(`[ProduceScan] onFrame error: ${err?.message || err}`);
    } finally {
      if (gpuFrame != null) {
        gpuFrame.dispose();
      }
      frame.dispose();
    }
  }, [boxedModel, boxedResizer, handleLiveDetection]);

  const frameOutput = useFrameOutput({
    onFrame,
    pixelFormat: 'yuv',
  });

  const animatedBoundingBoxStyle = useAnimatedStyle(() => ({
    left: boxX.value,
    top: boxY.value,
    width: boxWidth.value,
    height: boxHeight.value,
    opacity: withTiming(boxOpacity.value, { duration: 150 }),
  }));

  const currentItem = PRODUCE_MODEL_CATALOG[selectedProduceKey] || PRODUCE_MODEL_CATALOG['apple'];

  const filteredCatalog = SUPPORTED_PRODUCE_CLASSES.filter((key) => {
    const it = PRODUCE_MODEL_CATALOG[key];
    if (!it) return false;
    const q = searchQuery.toLowerCase().trim();
    return it.displayName.toLowerCase().includes(q) || it.modelLabel.toLowerCase().includes(q);
  });

  const getVerdictColor = (verdict) => {
    if (verdict === 'SAFE') return '#2ECC71';
    if (verdict === 'CAUTION') return '#F39C12';
    return '#E74C3C';
  };

  const getVerdictBg = (verdict) => {
    if (verdict === 'SAFE') return '#EAFBF0';
    if (verdict === 'CAUTION') return '#FEF7EA';
    return '#FDECEC';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={fs(22)} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Veg & Fruit Scanner</Text>
          <Text style={styles.headerSubtitle}>
            Active: <Text style={{ color: '#2ECC71', fontWeight: 'bold' }}>{activeProfile?.fullName || 'Main Profile'}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.headerButton, torchOn && styles.headerButtonActive]}
          onPress={() => setTorchOn(!torchOn)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name={torchOn ? 'zap' : 'zap-off'} size={fs(18)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Live Vision Camera View with YOLO Detection */}
      <View style={styles.cameraBox}>
        {hasPermission && device ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            torch={torchOn ? 'on' : 'off'}
            outputs={[frameOutput]}
          />
        ) : (
          <View style={styles.noCameraBox}>
            <Feather name="camera-off" size={fs(36)} color="#999" />
            <Text style={styles.noCameraText}>Camera access required</Text>
            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
              <Text style={styles.grantBtnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Central Single-Object Focus Guide Reticle */}
        {!isLocked && (
          <View style={styles.focusReticleContainer} pointerEvents="none">
            <View style={styles.reticleCornerTL} />
            <View style={styles.reticleCornerTR} />
            <View style={styles.reticleCornerBL} />
            <View style={styles.reticleCornerBR} />
            <Text style={styles.reticleGuideText}>Focus 1 Produce Item</Text>
          </View>
        )}

        {/* Real-time Animated Bounding Box - Only shown while searching, hidden once locked so only AR Feedback Stamp appears on the object */}
        {!isLocked && !isConfirmed && (
          <Animated.View style={[styles.detectedBox, animatedBoundingBoxStyle]}>
            <View style={styles.detectedTag}>
              <Text style={styles.detectedTagText}>
                {currentItem.emoji} {currentItem.displayName} {detectedClassIdx >= 0 ? `[ID:${detectedClassIdx}]` : ''} {detectionConfidence >= 50 ? `(${detectionConfidence}%)` : ''}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Live AR Feedback Stamp: Green Checkmark (✓) if Safe, Red Cross (✗) if Unsafe */}
        <ARFeedbackStamp
          visible={Boolean(evaluation && (isConfirmed || isLocked))}
          isSafe={evaluation?.verdict === 'SAFE'}
          panAnim={arTracker.panAnim}
          rollAnim={arTracker.rollAnim}
          containerWidth={SCREEN_WIDTH}
          containerHeight={CAMERA_HEIGHT}
          size={110}
        />

        {/* Correction Feedback Toast Banner */}
        {correctionToast && (
          <View style={styles.toastBanner}>
            <Text style={styles.toastBannerText}>{correctionToast}</Text>
          </View>
        )}

        {/* Model State Pill */}
        {tfModel.state === 'loading' && (
          <View style={styles.modelStatusPill}>
            <ActivityIndicator size="small" color="#2ECC71" style={{ marginRight: 6 }} />
            <Text style={styles.modelStatusText}>Loading Vision Model...</Text>
          </View>
        )}

        {/* Top Detection Candidates Pill - Only if confidence >= 50% */}
        {detectionConfidence >= 50 && topCandidates.filter((c) => c.score >= 50).length > 0 && (
          <View style={styles.candidatesRow}>
            {topCandidates.filter((c) => c.score >= 50).map((cand, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.candidateChip,
                  selectedProduceKey === cand.label && styles.candidateChipActive,
                ]}
                onPress={() => handleConfirmProduce(cand.label)}
              >
                <Text style={styles.candidateChipText}>
                  {PRODUCE_MODEL_CATALOG[cand.label]?.emoji || '🥗'} #{cand.classIdx} {cand.label} ({cand.score}%)
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Lock / Freeze Detection Toggle */}
        <TouchableOpacity
          style={[styles.lockButton, isLocked && styles.lockButtonActive]}
          onPress={handleToggleLock}
          activeOpacity={0.8}
        >
          <Feather name={isLocked ? 'unlock' : 'lock'} size={fs(14)} color="#FFF" style={{ marginRight: 4 }} />
          <Text style={styles.lockButtonText}>{isLocked ? 'Unlock' : 'Live Tracking'}</Text>
        </TouchableOpacity>

        {/* Quick Browse Tray Button */}
        <TouchableOpacity
          style={styles.catalogTrayToggle}
          onPress={() => setShowCatalogList(!showCatalogList)}
          activeOpacity={0.8}
        >
          <Text style={styles.catalogTrayEmoji}>{isConfirmed || detectionConfidence >= 50 ? currentItem.emoji : '🔍'}</Text>
          <Text style={styles.catalogTrayText}>
            {isConfirmed || detectionConfidence >= 50
              ? `${currentItem.displayName} • ${servingWeight}g`
              : 'Point at 1 Fruit / Veg (≥ 50% only)'}
          </Text>
          <Feather name={showCatalogList ? 'chevron-down' : 'chevron-up'} size={fs(18)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Manual Selection Overlay OR Clinical Health Rules Card */}
      {showCatalogList ? (
        <View style={styles.catalogOverlay}>
          <View style={styles.catalogHeader}>
            <Text style={styles.catalogTitle}>All 47 Supported Produce</Text>
            <TouchableOpacity onPress={() => setShowCatalogList(false)}>
              <Feather name="x" size={fs(22)} color="#333" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search produce (e.g. apple, banana, broccoli)..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView style={styles.catalogScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.catalogGrid}>
              {filteredCatalog.map((key) => {
                const it = PRODUCE_MODEL_CATALOG[key];
                const isSelected = selectedProduceKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.catalogItem, isSelected && styles.catalogItemSelected]}
                    onPress={() => {
                      handleConfirmProduce(key);
                      setShowCatalogList(false);
                    }}
                  >
                    <Text style={styles.catalogItemEmoji}>{it.emoji}</Text>
                    <Text style={styles.catalogItemName} numberOfLines={1}>{it.displayName}</Text>
                    <Text style={styles.catalogItemWeight}>{it.defaultWeight_g}g</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : (
        /* Result Container: Confirmation Step OR Clinical Food Safety Rules */
        <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          {!isConfirmed ? (
            detectionConfidence >= 50 ? (
              /* Verified High-Confidence Produce Detection Card (>= 50%) */
              <View style={styles.card}>
                <View style={styles.confirmHeaderRow}>
                  <View style={styles.confirmHeaderEmojiBox}>
                    <Text style={{ fontSize: fs(34) }}>{currentItem.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: wp(3) }}>
                    <Text style={styles.cardTitle}>{currentItem.displayName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View style={[styles.confidencePill, styles.confidencePillHigh]}>
                        <Feather
                          name="check-circle"
                          size={fs(12)}
                          color="#009933"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.confidencePillText, { color: '#009933' }]}>
                          Verified Match ({detectionConfidence}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={styles.confirmInstructionText}>
                  High accuracy match ({detectionConfidence}%). Hold steady to lock automatically, or tap below to view results now.
                </Text>

                {/* Primary Instant Fix Button */}
                <TouchableOpacity
                  style={styles.primaryConfirmBtn}
                  onPress={() => handleConfirmProduce(selectedProduceKey)}
                  activeOpacity={0.8}
                >
                  <Feather name="lock" size={fs(18)} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryConfirmBtnText}>Fix & View Results: {currentItem.displayName}</Text>
                </TouchableOpacity>

                {/* Top Candidates Selection (Only if score >= 50%) */}
                {topCandidates.filter((c) => c.score >= 50 && c.label !== selectedProduceKey).length > 0 && (
                  <View style={styles.candidatesConfirmBox}>
                    <Text style={styles.candidatesConfirmTitle}>Or choose other verified candidate (≥ 50%):</Text>
                    <View style={styles.candidatesConfirmGrid}>
                      {topCandidates.filter((c) => c.score >= 50 && c.label !== selectedProduceKey).map((cand, idx) => {
                        const itemData = PRODUCE_MODEL_CATALOG[cand.label];
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={styles.candidateConfirmChip}
                            onPress={() => handleConfirmProduce(cand.label)}
                          >
                            <Text style={{ fontSize: fs(18), marginRight: 6 }}>{itemData?.emoji || '🥗'}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.candidateConfirmName}>{cand.label}</Text>
                              <Text style={styles.candidateConfirmScore}>{cand.score}% match</Text>
                            </View>
                            <Feather name="chevron-right" size={fs(14)} color="#666" />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Browse Catalog & Threshold Settings Row */}
                <View style={styles.confirmActionsRow}>
                  <TouchableOpacity
                    style={styles.browseAllBtn}
                    onPress={() => setShowCatalogList(true)}
                  >
                    <Feather name="grid" size={fs(14)} color="#009933" style={{ marginRight: 6 }} />
                    <Text style={styles.browseAllBtnText}>Browse All 47 Produce</Text>
                  </TouchableOpacity>

                  <View style={styles.thresholdStepper}>
                    <Text style={styles.thresholdLabel}>Thresh:</Text>
                    <TouchableOpacity
                      style={styles.threshBtn}
                      onPress={() => setConfidenceThreshold((prev) => Math.max(0.50, Number((prev - 0.05).toFixed(2))))}
                    >
                      <Feather name="minus" size={fs(12)} color="#444" />
                    </TouchableOpacity>
                    <Text style={styles.threshValue}>{Math.round(confidenceThreshold * 100)}%</Text>
                    <TouchableOpacity
                      style={styles.threshBtn}
                      onPress={() => setConfidenceThreshold((prev) => Math.min(0.90, Number((prev + 0.05).toFixed(2))))}
                    >
                      <Feather name="plus" size={fs(12)} color="#444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              /* Scanning Guide State (When detection < 50%, completely hide any under-50% detection) */
              <View style={styles.card}>
                <View style={styles.scanningGuideRow}>
                  <View style={styles.scanningGuideIconBox}>
                    <Feather name="maximize" size={fs(26)} color="#009933" />
                  </View>
                  <View style={{ flex: 1, marginLeft: wp(3) }}>
                    <Text style={styles.cardTitle}>Align 1 Produce Item</Text>
                    <Text style={styles.scanningGuideSub}>
                      Aim reticle at fruit or vegetable. Items appear once accuracy is 50% or higher.
                    </Text>
                  </View>
                </View>

                <View style={styles.scanningTipsBox}>
                  <View style={styles.tipRow}>
                    <Feather name="check-circle" size={fs(13)} color="#009933" style={{ marginRight: 6, marginTop: 1 }} />
                    <Text style={styles.tipText}>Focus on one single produce object in the reticle</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Feather name="sun" size={fs(13)} color="#009933" style={{ marginRight: 6, marginTop: 1 }} />
                    <Text style={styles.tipText}>Keep good lighting and hold the phone steady</Text>
                  </View>
                </View>

                <View style={styles.confirmActionsRow}>
                  <TouchableOpacity
                    style={styles.browseAllBtn}
                    onPress={() => setShowCatalogList(true)}
                  >
                    <Feather name="grid" size={fs(14)} color="#009933" style={{ marginRight: 6 }} />
                    <Text style={styles.browseAllBtnText}>Browse / Pick Produce Manually</Text>
                  </TouchableOpacity>

                  <View style={styles.thresholdStepper}>
                    <Text style={styles.thresholdLabel}>Min Thresh:</Text>
                    <Text style={styles.threshValue}>{Math.round(confidenceThreshold * 100)}%</Text>
                  </View>
                </View>
              </View>
            )
          ) : evaluation ? (
            /* Confirmed Clinical Rule-Based Recommendation Card */
            <View style={styles.card}>
                {/* Confirmed Banner with Re-scan button */}
                <View style={styles.confirmedStatusBar}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Feather name="lock" size={fs(14)} color="#009933" style={{ marginRight: 5 }} />
                    <Text style={styles.confirmedStatusText}>
                      Fixed: {evaluation.item.displayName} ({detectionConfidence >= 50 ? `${detectionConfidence}%` : 'Confirmed'})
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.rescanBtn} onPress={handleResetScan}>
                    <Feather name="refresh-cw" size={fs(12)} color="#009933" style={{ marginRight: 4 }} />
                    <Text style={[styles.rescanBtnText, { color: '#009933', fontWeight: 'bold' }]}>Scan Next</Text>
                  </TouchableOpacity>
                </View>
              {/* Product Header & Verdict Badge */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleBox}>
                  <Text style={styles.cardEmoji}>{evaluation.item.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: wp(3) }}>
                    <Text style={styles.cardTitle}>{evaluation.item.displayName}</Text>
                    <Text style={styles.cardCategory}>{evaluation.item.category.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Verdict Pill */}
                <View style={[styles.verdictPill, { backgroundColor: getVerdictBg(evaluation.verdict), borderColor: getVerdictColor(evaluation.verdict) }]}>
                  <Feather
                    name={evaluation.verdict === 'SAFE' ? 'check-circle' : evaluation.verdict === 'CAUTION' ? 'alert-triangle' : 'slash'}
                    size={fs(14)}
                    color={getVerdictColor(evaluation.verdict)}
                  />
                  <Text style={[styles.verdictText, { color: getVerdictColor(evaluation.verdict) }]}>
                    {evaluation.verdict}
                  </Text>
                </View>
              </View>

              {/* Portion Weight Adjuster (Clinical Default applied by default) */}
              <View style={styles.portionBox}>
                <View>
                  <Text style={styles.portionLabel}>Serving Weight</Text>
                  <Text style={styles.portionSub}>{evaluation.servingDescription}</Text>
                </View>
                <View style={styles.weightStepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustWeight(-10)}>
                    <Feather name="minus" size={fs(16)} color="#009933" />
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>{servingWeight}g</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjustWeight(10)}>
                    <Feather name="plus" size={fs(16)} color="#009933" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary Health Advice */}
              <View style={styles.reasonBox}>
                <Text style={styles.reasonHeadline}>{evaluation.headline}</Text>
                <Text style={styles.reasonBody}>{evaluation.primaryReason}</Text>
              </View>

              {/* Cautions / Warnings */}
              {evaluation.cautions.length > 0 && (
                <View style={styles.cautionsBox}>
                  {evaluation.cautions.map((caution, idx) => (
                    <View key={idx} style={styles.cautionRow}>
                      <Feather name="alert-circle" size={fs(14)} color="#E74C3C" style={{ marginTop: 2 }} />
                      <Text style={styles.cautionText}>{caution}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Portion-Scaled Nutritional Highlights */}
              <Text style={styles.nutrientsTitle}>Nutritional Intake for {servingWeight}g</Text>
              <View style={styles.nutrientPillsGrid}>
                {evaluation.consumedNutrientHighlights.map((n, idx) => (
                  <View key={idx} style={styles.nutrientPill}>
                    <Text style={styles.nutrientPillLabel}>{n.label}</Text>
                    <Text style={styles.nutrientPillValue}>{n.value}</Text>
                  </View>
                ))}
              </View>

              {/* Condition breakdown tags */}
              {evaluation.conditionEvaluations.length > 0 && (
                <View style={styles.conditionsBreakdown}>
                  <Text style={styles.conditionsBreakdownTitle}>Condition-Specific Health Rules</Text>
                  {evaluation.conditionEvaluations.map((cond, idx) => (
                    <View key={idx} style={styles.conditionRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather
                          name={cond.verdict === 'SAFE' ? 'check' : 'alert-circle'}
                          size={fs(14)}
                          color={getVerdictColor(cond.verdict)}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.conditionName}>
                          {cond.condition.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.conditionReason}>{cond.reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.2),
    backgroundColor: '#111827',
  },
  headerButton: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonActive: {
    backgroundColor: '#F39C12',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(16),
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(11),
    color: '#9CA3AF',
  },
  cameraBox: {
    width: SCREEN_WIDTH,
    height: CAMERA_HEIGHT,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  noCameraBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCameraText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.medium,
    marginTop: hp(1),
  },
  grantBtn: {
    backgroundColor: '#009933',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(2),
    marginTop: hp(2),
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.semiBold,
  },
  detectedBox: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#2ECC71',
    borderRadius: 8,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
  },
  detectedTag: {
    position: 'absolute',
    top: -24,
    left: 0,
    backgroundColor: '#2ECC71',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detectedTagText: {
    color: '#000',
    fontFamily: typography.fonts.bold,
    fontSize: fs(11),
  },
  modelStatusPill: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modelStatusText: {
    color: '#FFF',
    fontSize: fs(11),
    fontFamily: typography.fonts.medium,
  },
  candidatesRow: {
    position: 'absolute',
    top: 10,
    left: wp(4),
    flexDirection: 'row',
    gap: 6,
  },
  candidateChip: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  candidateChipActive: {
    backgroundColor: 'rgba(0,153,51,0.85)',
    borderColor: '#2ECC71',
  },
  candidateChipText: {
    color: '#FFF',
    fontSize: fs(10),
    fontFamily: typography.fonts.semiBold,
  },
  lockButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockButtonActive: {
    backgroundColor: '#009933',
    borderColor: '#009933',
  },
  lockButtonText: {
    color: '#FFF',
    fontSize: fs(10),
    fontFamily: typography.fonts.semiBold,
  },
  catalogTrayToggle: {
    position: 'absolute',
    bottom: hp(1.2),
    left: wp(5),
    right: wp(5),
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: wp(5),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.9),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  catalogTrayEmoji: {
    fontSize: fs(18),
    marginRight: wp(2.5),
  },
  catalogTrayText: {
    flex: 1,
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(13),
    color: '#FFFFFF',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#EEF5EE',
  },
  resultContent: {
    padding: wp(4),
    paddingBottom: hp(5),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(4),
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1.5),
  },
  cardTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardEmoji: {
    fontSize: fs(30),
  },
  cardTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(17),
    color: '#1A1A1A',
  },
  cardCategory: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(10),
    color: '#666',
    letterSpacing: 0.5,
  },
  verdictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: wp(4),
    borderWidth: 1,
  },
  verdictText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(12),
    marginLeft: wp(1.5),
  },
  portionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: wp(2.8),
    borderRadius: wp(3),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  portionLabel: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(12),
    color: '#1A1A1A',
  },
  portionSub: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(11),
    color: '#666',
  },
  weightStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#009933',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.4),
  },
  stepBtn: {
    padding: wp(1),
  },
  stepperVal: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(13),
    color: '#009933',
    minWidth: wp(11),
    textAlign: 'center',
  },
  reasonBox: {
    marginBottom: hp(1.5),
  },
  reasonHeadline: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(14),
    color: '#1A1A1A',
    marginBottom: hp(0.4),
  },
  reasonBody: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(13),
    color: '#444444',
    lineHeight: fs(13) * 1.45,
  },
  cautionsBox: {
    backgroundColor: '#FDECEC',
    padding: wp(3),
    borderRadius: wp(3),
    marginBottom: hp(1.5),
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  cautionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp(0.4),
  },
  cautionText: {
    flex: 1,
    fontFamily: typography.fonts.medium,
    fontSize: fs(12),
    color: '#C0392B',
    marginLeft: wp(2),
  },
  nutrientsTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(13),
    color: '#1A1A1A',
    marginBottom: hp(0.8),
  },
  nutrientPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    marginBottom: hp(1.5),
  },
  nutrientPill: {
    backgroundColor: '#F2F8F4',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: '#D4EAD9',
  },
  nutrientPillLabel: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(10),
    color: '#555',
  },
  nutrientPillValue: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(12),
    color: '#009933',
  },
  conditionsBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: hp(1.5),
    marginTop: hp(0.5),
  },
  conditionsBreakdownTitle: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(12),
    color: '#666',
    marginBottom: hp(0.8),
  },
  conditionRow: {
    marginBottom: hp(1),
  },
  conditionName: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(11),
    color: '#333',
  },
  conditionReason: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(11.5),
    color: '#555',
    marginLeft: wp(5),
    marginTop: hp(0.2),
  },
  catalogOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: wp(5),
    borderTopRightRadius: wp(5),
    padding: wp(4),
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1.2),
  },
  catalogTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(15),
    color: '#1A1A1A',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: wp(3),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1),
    fontFamily: typography.fonts.regular,
    fontSize: fs(13),
    color: '#1A1A1A',
    marginBottom: hp(1.2),
  },
  catalogScrollView: {
    flex: 1,
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2.5),
    paddingBottom: hp(4),
  },
  catalogItem: {
    width: (SCREEN_WIDTH - wp(13)) / 3,
    backgroundColor: '#F8F9FA',
    borderRadius: wp(3),
    padding: wp(2.5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  catalogItemSelected: {
    backgroundColor: '#EAFBF0',
    borderColor: '#009933',
  },
  catalogItemEmoji: {
    fontSize: fs(22),
    marginBottom: hp(0.4),
  },
  catalogItemName: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(11.5),
    color: '#1A1A1A',
    textAlign: 'center',
  },
  catalogItemWeight: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(10),
    color: '#888',
    marginTop: 2,
  },
  detectedTagLowConf: {
    backgroundColor: '#D97706',
  },
  toastBanner: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
  },
  toastBannerText: {
    color: '#FFF',
    fontSize: fs(12),
    fontFamily: typography.fonts.semiBold,
  },
  scanningGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  scanningGuideIconBox: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(3),
    backgroundColor: '#EAFBF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningGuideSub: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(12),
    color: '#666',
    marginTop: 2,
    lineHeight: fs(12) * 1.35,
  },
  scanningTipsBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: wp(3),
    padding: wp(3),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(0.3),
  },
  tipText: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(11.5),
    color: '#4B5563',
  },
  confirmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  confirmHeaderEmojiBox: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(3),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  confidencePillHigh: {
    backgroundColor: '#EAFBF0',
  },
  confidencePillLow: {
    backgroundColor: '#FEF3C7',
  },
  confidencePillText: {
    fontSize: fs(10.5),
    fontFamily: typography.fonts.bold,
  },
  confirmInstructionText: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(12.5),
    color: '#4B5563',
    lineHeight: fs(12.5) * 1.45,
    marginBottom: hp(1.8),
  },
  primaryConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009933',
    paddingVertical: hp(1.5),
    borderRadius: wp(3),
    marginBottom: hp(1.8),
    shadowColor: '#009933',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryConfirmBtnText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(14),
    color: '#FFFFFF',
  },
  candidatesConfirmBox: {
    marginBottom: hp(1.5),
  },
  candidatesConfirmTitle: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(12),
    color: '#6B7280',
    marginBottom: hp(0.8),
  },
  candidatesConfirmGrid: {
    gap: hp(0.8),
  },
  candidateConfirmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: wp(2.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  candidateConfirmChipSelected: {
    backgroundColor: '#EAFBF0',
    borderColor: '#2ECC71',
  },
  candidateConfirmName: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(12.5),
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  candidateConfirmScore: {
    fontFamily: typography.fonts.regular,
    fontSize: fs(10.5),
    color: '#6B7280',
  },
  confirmActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: hp(1),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  browseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(0.6),
  },
  browseAllBtnText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(12),
    color: '#009933',
  },
  thresholdStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: wp(2),
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thresholdLabel: {
    fontFamily: typography.fonts.medium,
    fontSize: fs(10),
    color: '#6B7280',
    marginRight: 4,
  },
  threshBtn: {
    padding: 3,
  },
  threshValue: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(11),
    color: '#1F2937',
    minWidth: 32,
    textAlign: 'center',
  },
  confirmedStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: wp(2.5),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  confirmedStatusText: {
    fontFamily: typography.fonts.bold,
    fontSize: fs(11.5),
    color: '#15803D',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  rescanBtnText: {
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(11),
    color: '#4B5563',
  },
  detectedBoxLocked: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
  },
  detectedTagLocked: {
    backgroundColor: '#009933',
  },
  focusReticleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: wp(55),
    height: wp(55),
    marginTop: -wp(27.5),
    marginLeft: -wp(27.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(46, 204, 113, 0.85)',
    borderTopLeftRadius: 6,
  },
  reticleCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(46, 204, 113, 0.85)',
    borderTopRightRadius: 6,
  },
  reticleCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 22,
    height: 22,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(46, 204, 113, 0.85)',
    borderBottomLeftRadius: 6,
  },
  reticleCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(46, 204, 113, 0.85)',
    borderBottomRightRadius: 6,
  },
  reticleGuideText: {
    color: '#FFFFFF',
    fontFamily: typography.fonts.semiBold,
    fontSize: fs(11),
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
