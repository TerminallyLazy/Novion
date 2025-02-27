export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please add it to your .env.local file:\n' +
      'GEMINI_API_KEY=your_api_key_here'
    );
  }
  return apiKey;
}

// Validate environment variables at startup
export function validateEnv() {
  try {
    getGeminiApiKey();
    console.log('Environment variables validated successfully');
  } catch (error) {
    console.error('Environment validation failed:', error);
    throw error;
  }
} 