import { logProduceCorrection, getLoggedProduceCorrections } from '../services/produceCorrectionLogger';
import * as FileSystem from 'expo-file-system/legacy';

jest.mock('expo-file-system/legacy', () => {
  let fileStorage: Record<string, string> = {};
  return {
    documentDirectory: 'file:///mock_docs/',
    getInfoAsync: jest.fn(async (uri: string) => {
      return { exists: uri in fileStorage || uri.endsWith('/') };
    }),
    makeDirectoryAsync: jest.fn(async () => {}),
    writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
      fileStorage[uri] = content;
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
      return fileStorage[uri] || '[]';
    }),
    copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      fileStorage[to] = 'mock_image_bytes';
    }),
    __clearStorage: () => {
      fileStorage = {};
    },
  };
});

describe('ProduceCorrectionLogger', () => {
  beforeEach(() => {
    (FileSystem as any).__clearStorage();
    jest.clearAllMocks();
  });

  it('logs a user correction with metadata and image path', async () => {
    const record = await logProduceCorrection({
      imageUri: 'file:///temp/camera_frame_123.jpg',
      modelPredictedLabel: 'apple',
      modelConfidence: 0.42,
      userCorrectedLabel: 'peach',
      topCandidates: [
        { label: 'apple', score: 42, classIdx: 1 },
        { label: 'peach', score: 38, classIdx: 36 },
      ],
    });

    expect(record).not.toBeNull();
    expect(record?.modelPredictedLabel).toBe('apple');
    expect(record?.userCorrectedLabel).toBe('peach');
    expect(record?.modelConfidence).toBe(0.42);
    expect(record?.imageUri).toContain('peach.jpg');

    const logs = await getLoggedProduceCorrections();
    expect(logs.length).toBe(1);
    expect(logs[0].userCorrectedLabel).toBe('peach');
    expect(logs[0].topCandidates.length).toBe(2);
  });

  it('appends multiple corrections in chronological order', async () => {
    await logProduceCorrection({
      modelPredictedLabel: 'banana',
      modelConfidence: 0.35,
      userCorrectedLabel: 'cucumber',
    });

    await logProduceCorrection({
      modelPredictedLabel: 'lime',
      modelConfidence: 0.48,
      userCorrectedLabel: 'lemon',
    });

    const logs = await getLoggedProduceCorrections();
    expect(logs.length).toBe(2);
    expect(logs[0].userCorrectedLabel).toBe('cucumber');
    expect(logs[1].userCorrectedLabel).toBe('lemon');
  });
});
