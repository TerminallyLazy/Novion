// -------------------
// lib/api/index.ts
// -------------------


// Types for usage
export interface UserSettings {
  theme: 'light' | 'dark';
  layout?: '1x1' | '2x2' | '3x1';
}

export interface Study {
  id: string;
  description: string;
  modality: string;
  date: string;
  patientId: string;
}

export interface AnalysisResult {
  id: string;
  type: string;
  confidence: number;
  findings: string[];
  segmentation?: string;
  status?: 'processing' | 'completed' | 'failed';
  message?: string;
  analysis?: {
    type: string;
    confidence: number;
    findings: string[];
    segmentation?: string;
  };
}

export interface SearchResult {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  message?: string;
  results?: Array<{
    id: string;
    confidence: number;
    findings: string[];
  }>;
  searchParams?: {
    patientId?: string;
    modality?: string;
    description?: string;
  };
}

export interface VoiceResponse {
  id: string;
  status: 'starting' | 'processing' | 'completed' | 'failed';
  message?: string;
  action?: {
    type:
      | 'ZOOM'
      | 'PAN'
      | 'MEASURE'
      | 'WINDOW_LEVEL'
      | 'ANALYZE'
      | 'SEARCH';
    params?: Record<string, unknown>;
  };
}

// API client with placeholder (mock) methods:
export const apiClient = {
  // User Settings
  getUserSettings: async (): Promise<UserSettings> => {
    // Placeholder for server call or real fetch
    return { theme: 'light' };
  },

  updateUserSettings: async (
    settings: Partial<UserSettings>
  ): Promise<UserSettings> => {
    // Placeholder for server call or real fetch
    return {
      theme: settings.theme || 'light',
      layout: settings.layout || '1x1',
    };
  },

  // Studies
  listStudies: async (): Promise<Study[]> => {
    // Placeholder for server call or real fetch
    return [];
  },

  // Analysis
  analyzeImage: async ({
    model,
    imageId,
  }: {
    model: string;
    imageId: string;
  }): Promise<AnalysisResult> => {
    return {
      id: 'analysis_id',
      type: 'analysis',
      confidence: 0.9,
      findings: [],
      status: 'processing',
      message: 'Analyzing image...',
    };
  },

  getAnalysisResults: async ({
    studyId,
  }: {
    studyId: string;
  }): Promise<AnalysisResult[]> => {
    // Placeholder
    return [];
  },

  // Search
  searchMedicalImages: async ({
    query,
    mode,
  }: {
    query: string;
    mode: 'text' | 'voice';
  }): Promise<SearchResult> => {
    return {
      id: 'search-id',
      status: 'RUNNING',
      message: 'Searching...',
    };
  },

  getSearchResults: async ({
    taskId,
  }: {
    taskId: string;
  }): Promise<SearchResult> => {
    return {
      id: taskId,
      status: 'COMPLETED',
      results: [],
    };
  },

  // Voice Commands
  startVoiceSession: async (): Promise<VoiceResponse> => {
    return {
      id: 'session-id',
      status: 'starting',
      message: 'Initializing voice session...',
    };
  },

  processVoiceCommand: async ({
    command,
  }: {
    command: string;
  }): Promise<VoiceResponse> => {
    return {
      id: 'command-id',
      status: 'processing',
      message: `Processing command: ${command}`,
    };
  },

  textToSpeechResponse: async ({
    text,
  }: {
    text: string;
  }): Promise<{ audioUrl: string }> => {
    return { audioUrl: 'path/to/file.mp3' };
  },
};

// Type Inference Helpers
export type inferRPCInputType<TFunction> = TFunction extends (args: infer TArgs) => any
  ? TArgs
  : never;

export type inferRPCOutputType<TFunction> = TFunction extends (
  ...args: any[]
) => Promise<infer TReturn>
  ? TReturn
  : never;