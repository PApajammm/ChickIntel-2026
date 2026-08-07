import * as ImageManipulator from "expo-image-manipulator";

type CropOptions = {
  photoUri: string;
  photoWidth: number;
  photoHeight: number;
  viewfinderSize: number;
  screenWidth: number;
  screenHeight: number;
};

/**
 * Crops a captured photo to match the centered viewfinder box guide on screen.
 */
export async function cropPhotoToViewfinder({
  photoUri,
  photoWidth,
  photoHeight,
  viewfinderSize,
  screenWidth,
  screenHeight,
}: CropOptions): Promise<{ uri: string; width: number; height: number }> {
  try {
    if (!photoUri) {
      return { uri: photoUri, width: photoWidth, height: photoHeight };
    }

    const manipulateFn =
      ImageManipulator.manipulateAsync ||
      (ImageManipulator as any).default?.manipulateAsync;

    if (!manipulateFn || typeof manipulateFn !== "function") {
      return { uri: photoUri, width: photoWidth, height: photoHeight };
    }

    if (!photoWidth || !photoHeight || !screenWidth || !screenHeight) {
      return { uri: photoUri, width: photoWidth, height: photoHeight };
    }

    // Determine scale between screen coordinates and photo resolution
    const scaleX = photoWidth / screenWidth;
    const scaleY = photoHeight / screenHeight;
    const scale = Math.max(scaleX, scaleY);

    // Calculate crop dimensions in photo coordinate space
    const targetCropWidth = Math.round(viewfinderSize * scale);
    const targetCropHeight = Math.round(viewfinderSize * scale);

    const cropWidth = Math.min(photoWidth, Math.max(100, targetCropWidth));
    const cropHeight = Math.min(photoHeight, Math.max(100, targetCropHeight));

    const originX = Math.max(0, Math.round((photoWidth - cropWidth) / 2));
    const originY = Math.max(0, Math.round((photoHeight - cropHeight) / 2));

    const format =
      ImageManipulator.SaveFormat?.JPEG ??
      (ImageManipulator as any).SaveFormat?.JPEG ??
      "jpeg";

    const result = await manipulateFn(
      photoUri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
          },
        },
      ],
      {
        compress: 0.9,
        format,
      },
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.warn("[image-crop-helper] Cropping skipped, returning original photo:", error);
    return { uri: photoUri, width: photoWidth, height: photoHeight };
  }
}
