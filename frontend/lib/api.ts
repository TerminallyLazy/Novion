import { Study, Annotation, Report, AIAnalysis } from '@prisma/client';

// API endpoints
const API_BASE = '/api';

// API client for studies
export const studiesApi = {
  getAll: async (): Promise<Study[]> => {
    const res = await fetch(`${API_BASE}/studies`);
    if (!res.ok) throw new Error('Failed to fetch studies');
    return res.json();
  },
  
  getById: async (id: string): Promise<Study> => {
    const res = await fetch(`${API_BASE}/studies/${id}`);
    if (!res.ok) throw new Error('Failed to fetch study');
    return res.json();
  },
};

// API client for annotations
export const annotationsApi = {
  getByStudyId: async (studyId: string): Promise<Annotation[]> => {
    const res = await fetch(`${API_BASE}/studies/${studyId}/annotations`);
    if (!res.ok) throw new Error('Failed to fetch annotations');
    return res.json();
  },
  
  create: async (data: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> => {
    const res = await fetch(`${API_BASE}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create annotation');
    return res.json();
  },
};

// API client for AI analysis
export const aiApi = {
  analyze: async (studyId: string, model: string): Promise<AIAnalysis> => {
    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studyId, model }),
    });
    if (!res.ok) throw new Error('Failed to start AI analysis');
    return res.json();
  },
  
  getResult: async (taskId: string): Promise<AIAnalysis> => {
    const res = await fetch(`${API_BASE}/ai/results/${taskId}`);
    if (!res.ok) throw new Error('Failed to fetch AI analysis result');
    return res.json();
  },
};

// API client for reports
export const reportsApi = {
  getByStudyId: async (studyId: string): Promise<Report[]> => {
    const res = await fetch(`${API_BASE}/studies/${studyId}/reports`);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },
  
  create: async (data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> => {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create report');
    return res.json();
  },
};

// Combined API client
export const apiClient = {
  studies: studiesApi,
  annotations: annotationsApi,
  ai: aiApi,
  reports: reportsApi,
}; 