export function languageAfterSuccessfulLoad(
  currentLanguage: string,
  targetLanguageCode: string | null | undefined,
  hasLoadedSuccessfully: boolean
): string {
  if (!hasLoadedSuccessfully && targetLanguageCode) return targetLanguageCode;
  return currentLanguage;
}
