/**
 * Foto-shrink voor AI-scans (gedeeld door factuur-scan en teller-scan, fase D).
 * Houdt verzoeken ruim onder de Edge-Function-limiet (8 MB) en binnen de
 * AI-timeout: max 1400 px langste zijde, JPEG q0,7.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { detectImageMime, base64ToBytes } from './base64';

/**
 * Verklein een gekozen foto vóór verzending. Mislukt het verkleinen, dan
 * gaan we door met de originele foto — de scan wordt gewoon geprobeerd.
 */
export async function shrinkForScan(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ base64: string; mime: string }> {
  const origBase64 = asset.base64;
  if (!origBase64) throw new Error('Foto bevat geen data.');
  const original = {
    base64: origBase64,
    mime: asset.mimeType ?? detectImageMime(base64ToBytes(origBase64)),
  };
  const big = (asset.width ?? 0) > 1400 || (asset.height ?? 0) > 1400;
  if (!big) return original;
  try {
    const w = asset.width ?? 0;
    const h = asset.height ?? 0;
    const scale = 1400 / Math.max(w, h);
    const ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri).resize({
      width: Math.round(w * scale),
      height: Math.round(h * scale),
    });
    const ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (saved.base64) {
      return { base64: saved.base64, mime: 'image/jpeg' };
    }
    return original;
  } catch (err) {
    console.log('[scan] Verkleinen mislukt, origineel gebruikt:', err instanceof Error ? err.message : err);
    return original;
  }
}
