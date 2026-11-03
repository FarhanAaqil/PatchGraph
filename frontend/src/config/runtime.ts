export interface RuntimeConfig {
  apiBaseUrl: string;
  offlineDemoMode: boolean;
  maxUploadBytes: number;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: '/api/v1',
  offlineDemoMode: true,
  maxUploadBytes: 25 * 1024 * 1024,
};
