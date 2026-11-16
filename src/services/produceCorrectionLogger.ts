import * as FileSystem from 'expo-file-system/legacy';

export interface ProduceCorrectionCandidate {
  label: string;
  score: number;
  classIdx?: number;
}

export interface ProduceCorrectionRecord {
  id: string;
  timestamp: string;
  imageUri: string | null;
  modelPredictedLabel: string;
  modelConfidence: number;
  userCorrectedLabel: string;
  topCandidates: ProduceCorrectionCandidate[];
}

const CORRECTIONS_DIR = `${FileSystem.documentDirectory}produce_corrections/`;
const IMAGES_DIR = `${CORRECTIONS_DIR}images/`;
const LOG_FILE = `${CORRECTIONS_DIR}corrections_log.json`;

/**
 * Ensure directory structure exists.
 */
export async function ensureCorrectionsDirectory(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn('[ProduceCorrectionLogger] Directory check error:', err);
  }
}

/**
 * Log a user correction along with the captured image.
 */
export async function logProduceCorrection({
  imageUri,
  modelPredictedLabel,
  modelConfidence,
  userCorrectedLabel,
  topCandidates = [],
}: {
  imageUri?: string | null;
  modelPredictedLabel: string;
  modelConfidence: number;
  userCorrectedLabel: string;
  topCandidates?: ProduceCorrectionCandidate[];
}): Promise<ProduceCorrectionRecord | null> {
  try {
    await ensureCorrectionsDirectory();

    const timestamp = new Date().toISOString();
    const id = `corr_${Date.now()}`;
    let savedImageUri: string | null = null;

    // Save/copy image if provided
    if (imageUri) {
      const sanitizedLabel = userCorrectedLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${Date.now()}_${sanitizedLabel}.jpg`;
      const targetUri = `${IMAGES_DIR}${filename}`;

      try {
        await FileSystem.copyAsync({
          from: imageUri,
          to: targetUri,
        });
        savedImageUri = targetUri;
      } catch (copyErr) {
        console.warn('[ProduceCorrectionLogger] Failed to copy image:', copyErr);
        savedImageUri = imageUri; // fallback to original path
      }
    }

    const record: ProduceCorrectionRecord = {
      id,
      timestamp,
      imageUri: savedImageUri,
      modelPredictedLabel,
      modelConfidence,
      userCorrectedLabel,
      topCandidates,
    };

    // Read existing logs
    let currentLogs: ProduceCorrectionRecord[] = [];
    try {
      const logInfo = await FileSystem.getInfoAsync(LOG_FILE);
      if (logInfo.exists) {
        const raw = await FileSystem.readAsStringAsync(LOG_FILE);
        currentLogs = JSON.parse(raw);
        if (!Array.isArray(currentLogs)) currentLogs = [];
      }
    } catch {
      currentLogs = [];
    }

    currentLogs.push(record);

    // Save updated logs
    await FileSystem.writeAsStringAsync(LOG_FILE, JSON.stringify(currentLogs, null, 2));
    console.log(`[ProduceCorrectionLogger] Logged correction: ${modelPredictedLabel} -> ${userCorrectedLabel}`);
    return record;
  } catch (err) {
    console.error('[ProduceCorrectionLogger] Error logging correction:', err);
    return null;
  }
}

/**
 * Retrieve all logged corrections.
 */
export async function getLoggedProduceCorrections(): Promise<ProduceCorrectionRecord[]> {
  try {
    const logInfo = await FileSystem.getInfoAsync(LOG_FILE);
    if (!logInfo.exists) return [];
    const raw = await FileSystem.readAsStringAsync(LOG_FILE);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[ProduceCorrectionLogger] Error reading logs:', err);
    return [];
  }
}
