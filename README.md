This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First things first, you need to install the dependencies:
```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Python Gemini Server Setup

The application requires a Python WebSocket server for handling Gemini AI interactions, audio processing, and real-time communication. Follow these steps to set up the server:

1. Make sure you have Python 3.8+ installed on your system

2. Create and activate a Python virtual environment:
```bash
# Create a virtual environment
python -m venv .venv --prompt radgemini

# Activate the virtual environment
# On Windows:
.\.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate
```

3. Install the required Python dependencies:
```bash
pip install -r requirements.txt
```

4. Set up your environment variables:
   - Create a `.env` file in the root directory
   - Add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

5. Start the Python server:
```bash
python lib/api/gemini-mm-live.py
```

The server will run on port 8080 by default. Make sure this port is available and not blocked by your firewall.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Troubleshooting Python Server

Common issues and solutions:

- **PyAudio installation issues**: 
  - Windows: `pip install pipwin && pipwin install pyaudio`
  - Linux: `sudo apt-get install python3-pyaudio`
  - macOS: `brew install portaudio && pip install pyaudio`

- **Port 8080 already in use**: 
  You can modify the `WEB_SERVER_PORT` in `lib/api/gemini-mm-live.py`

- **Gemini API key issues**:
  Make sure your API key is valid and has access to the Gemini API. You can get a key from the [Google AI Studio](https://makersuite.google.com/app/apikey).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.