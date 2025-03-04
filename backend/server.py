#!/usr/bin/env python
"""A FastAPI server exposing the medical research assistant API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from novion import process_query  # Import the functio
from dotenv import load_dotenv

app = FastAPI(title="Medical Research Assistant API")

load_dotenv(dotenv_path=".env.local")

# ✅ Enable CORS (Allow frontend to call API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (change in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request model
class QueryRequest(BaseModel):
    query: str

# ✅ Expose the query-processing endpoint
@app.post("/process")
async def process(request: QueryRequest):
    """API endpoint to process user queries and return only human-readable content."""
    response = process_query(request.query)
    return {"responses": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
