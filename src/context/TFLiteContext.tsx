import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { loadTensorflowModel, TensorflowPlugin } from "react-native-fast-tflite";
import { useResizer, ResizerState } from "react-native-vision-camera-resizer";
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

interface TFLiteContextType {
  tfModel: TensorflowPlugin;
  gpuResizer: ResizerState;
}

const TFLiteContext = createContext<TFLiteContextType | undefined>(undefined);

export function TFLiteProvider({ children }: { children: ReactNode }) {
  const [tfModel, setTfModel] = useState<TensorflowPlugin>({
    model: undefined,
    state: 'loading',
  });

  const gpuResizer = useResizer({
    width: 640,
    height: 640,
    channelOrder: "rgb",
    dataType: "uint8",
    scaleMode: "contain",
    pixelLayout: "planar",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadModel() {
      try {
        setTfModel({ model: undefined, state: 'loading' });

        const modelDir = FileSystem.documentDirectory + 'models/';
        const localPath = modelDir + 'best.tflite';

        const dirInfo = await FileSystem.getInfoAsync(modelDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
        }

        const fileInfo = await FileSystem.getInfoAsync(localPath);
        let resolvedUri: string = localPath;

        if (!fileInfo.exists || (fileInfo as any).size !== 10604911) {
          console.log('[TFLiteContext] Preparing fresh TFLite model asset...');
          const asset = Asset.fromModule(require('../../assets/models/best.tflite'));
          await asset.downloadAsync();
          const sourceUri = asset.localUri || asset.uri;

          if (sourceUri && (sourceUri.startsWith('file://') || sourceUri.startsWith('/'))) {
            // Delete old file if present
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(localPath, { idempotent: true });
            }
            await FileSystem.copyAsync({ from: sourceUri, to: localPath });
            resolvedUri = localPath;
          } else if (sourceUri) {
            try {
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(localPath, { idempotent: true });
              }
              await FileSystem.copyAsync({ from: sourceUri, to: localPath });
              resolvedUri = localPath;
            } catch {
              resolvedUri = sourceUri;
            }
          }
        }

        console.log('[TFLiteContext] Loading model from source:', resolvedUri);
        const m = await loadTensorflowModel({ url: resolvedUri }, []);

        if (isMounted) {
          setTfModel({ model: m, state: 'loaded' });
          console.log('[TFLiteContext] Model successfully loaded!');
        }
      } catch (err: any) {
        console.warn('[TFLiteContext] Gracefully handled TFLite model load error:', err?.message || err);
        if (isMounted) {
          setTfModel({
            model: undefined,
            state: 'error',
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    loadModel();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <TFLiteContext.Provider value={{ tfModel, gpuResizer }}>
      {children}
    </TFLiteContext.Provider>
  );
}

export function useTFLite() {
  const context = useContext(TFLiteContext);
  if (!context) {
    throw new Error("useTFLite must be used within a TFLiteProvider");
  }
  return context;
}
