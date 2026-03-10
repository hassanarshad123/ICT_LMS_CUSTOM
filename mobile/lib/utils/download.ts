import { Paths, downloadAsync } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

export async function downloadAndShare(url: string, fileName: string): Promise<void> {
  const cacheDir = Paths.cache.uri;
  const fileUri = `${cacheDir}${fileName}`;

  const result = await downloadAsync(url, fileUri);

  if (result.status !== 200) {
    throw new Error('Download failed');
  }

  const canShare = await isAvailableAsync();
  if (canShare) {
    await shareAsync(result.uri);
  } else {
    throw new Error('Sharing is not available on this device');
  }
}
