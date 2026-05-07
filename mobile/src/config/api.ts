import Constants from "expo-constants";
import { Platform } from "react-native";

const getDevHost = (): string | null => {
  const fromExpoConfig = (Constants.expoConfig as any)?.hostUri;
  const fromManifest2 = (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;
  const fromManifest = (Constants as any)?.manifest?.debuggerHost;

  const hostUri = fromExpoConfig || fromManifest2 || fromManifest;
  if (typeof hostUri !== "string" || !hostUri.trim()) {
    return null;
  }

  return hostUri.split(":")[0];
};

const configOrigin =
  typeof (Constants.expoConfig as any)?.extra?.apiBaseUrl === "string"
    ? String((Constants.expoConfig as any).extra.apiBaseUrl).trim()
    : "";

const fallbackHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const resolvedHost = getDevHost() || fallbackHost;

export const API_BASE_ORIGIN = configOrigin || `http://${resolvedHost}:5000`;
export const API_BASE_URL = `${API_BASE_ORIGIN}/api`;
