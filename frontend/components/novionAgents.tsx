import { useState } from "react";

export default function NovionAgent() {
    const [query, setQuery] = useState(""); // User input state
    const [response, setResponse] = useState(""); // API response state
    const [loading, setLoading] = useState(false); // Loading state

    // Function to send query to FastAPI backend
    const handleQuerySubmit = async () => {
        if (!query.trim()) return; // Prevent empty queries

        setLoading(true);
        try {
            const res = await fetch("http://localhost:8000/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });

            if (!res.ok) throw new Error("Failed to fetch data");

            const data = await res.json();
            setResponse(data.responses); // Store response
        } catch (error) {
            console.error("Error:", error);
            setResponse("Error fetching response.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-[calc(100%-44px)] overflow-hidden flex flex-col">
            {/* Title */}
            <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-gray-600">
                <h2 className="text-lg font-medium">Novion Agents</h2>
            </div>

            {/* Response Section */}
            <div className="flex-1 p-4 overflow-auto">
                {loading ? (
                    <p className="text-gray-500">Processing your request...</p>
                ) : response ? (
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                        <div
                            className="text-gray-800 dark:text-gray-200"
                            dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, "<br />") }}
                        />
                    </div>
                ) : (
                    <p className="text-gray-500">Enter a query to get a response.</p>
                )}
            </div>

            {/* Input Section */}
            <div className="p-4 border-t border-gray-300 dark:border-gray-600">
                <input
                    type="text"
                    placeholder="Enter query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                    type="button"
                    onClick={handleQuerySubmit}
                    className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                    disabled={loading}
                >
                    {loading ? "Processing..." : "Submit"}
                </button>
            </div>
        </div>
    );
}
