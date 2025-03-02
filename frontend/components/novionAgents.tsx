import { useState, useRef, useEffect } from "react";

export default function NovionAgent() {
    const [query, setQuery] = useState(""); // User input state
    const [loading, setLoading] = useState(false); // Loading state
    const [streamedResponse, setStreamedResponse] = useState<string>(""); // Streamed response state
    
    // Reference to the EventSource for streaming
    const eventSourceRef = useRef<EventSource | null>(null);
    
    // Clean up event source when component unmounts
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);
    
    // Function to handle streaming response
    const handleQuerySubmit = async () => {
        if (!query.trim()) return; // Prevent empty queries
        
        // Clear previous responses and set loading state
        setStreamedResponse("");
        setLoading(true);
        
        try {
            // Create a new EventSource for SSE with the query as a URL parameter
            const eventSource = new EventSource(`http://localhost:8000/stream?query=${encodeURIComponent(query)}`);
            eventSourceRef.current = eventSource;
            
            // Handle incoming messages
            eventSource.onmessage = (event) => {
                const data = event.data;
                console.log("Stream data:", data);
                
                // Check if we're at the end of the stream
                if (data === "[DONE]") {
                    eventSource.close();
                    setLoading(false);
                    return;
                }
                
                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.chunk) {
                        setStreamedResponse(prev => prev + parsedData.chunk);
                    }
                } catch (error) {
                    console.error("Error parsing stream data:", error);
                    // If it's not JSON, just append the data
                    setStreamedResponse(prev => prev + data);
                }
            };
            
            // Handle errors
            eventSource.onerror = (error) => {
                console.error("EventSource error:", error);
                eventSource.close();
                setLoading(false);
                setStreamedResponse(prev => prev + "\nConnection error. Please try again.");
            };
        } catch (error) {
            console.error("Streaming error:", error);
            setLoading(false);
            setStreamedResponse("Error initiating stream. Please try again.");
        }
    };

    // Improved markdown formatter with better URL handling
    const formatResponseContent = (response: string) => {
        if (typeof response !== 'string') return "Invalid response format";
        
        // First, escape any HTML to prevent injection
        const escapeHtml = (text: string) => {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };
        
        // Pre-process special patterns before escaping
        // Fix common malformed URL patterns
        let processed = response
            // Fix PubMed URL patterns that might be malformed
            .replace(/https?:\/\/\[https?:\/\/([^\]]+)\]/g, 'https://$1')
            // Fix PubMed parenthetical references to be clickable
            .replace(/PMID: (\d+) \((https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/[^)]+)\)/g, 'PMID: $1 <a href="$2" target="_blank">$2</a>')
            // Remove any nested markdown link structures
            .replace(/\[\s*https?:\/\/([^\]]+)\s*\]\s*\(\s*https?:\/\/([^)]+)\s*\)/g, 'https://$2');
        
        // First pass for URLs - mark them for later processing
        const urlPlaceholders: Record<string, {url: string, text: string}> = {};
        let urlCounter = 0;
        
        // Find and extract all URLs (both plain and in Markdown format)
        const urlRegex = /(?:\[([^\]]+)\]\()?(\bhttps?:\/\/[^\s()<>]+(?:\([^\s()<>]+\)|[^\s`!()\[\]{};:'".,<>?«»""'']))(?:\))?/g;
        processed = processed.replace(urlRegex, (match, linkText, url) => {
            const placeholder = `__URL_PLACEHOLDER_${urlCounter}__`;
            urlPlaceholders[placeholder] = {
                url: url,
                text: linkText || url
            };
            urlCounter++;
            return placeholder;
        });
        
        // Escape HTML in the processed content
        let escaped = escapeHtml(processed);
        
        // Restore URLs as proper HTML links
        Object.keys(urlPlaceholders).forEach(placeholder => {
            const {url, text} = urlPlaceholders[placeholder];
            escaped = escaped.replace(
                placeholder, 
                `<a href="${url}" target="_blank" class="text-blue-500 hover:underline">${escapeHtml(text)}</a>`
            );
        });
        
        // Process the rest of markdown
        return escaped
            // Convert newlines to breaks
            .replace(/\n/g, "<br>")
            // Headers
            .replace(/## ([^:\n]+):/g, '<h3 class="text-blue-600 dark:text-blue-400 font-medium mt-3 mb-1">$1</h3>')
            .replace(/### ([^\n]+)/g, '<h3 class="text-lg font-semibold mt-3 mb-1">$1</h3>')
            .replace(/#### ([^\n]+)/g, '<h4 class="text-md font-medium mt-2 mb-1">$1</h4>')
            // Bold and italic
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Code blocks - handle multiline code blocks
            .replace(/```([^`]*?)```/g, '<pre class="bg-gray-800 text-gray-200 p-2 rounded my-2 overflow-x-auto"><code>$1</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">$1</code>')
            // Lists with bullets
            .replace(/<br>- ([^\n<]+)/g, '<br><span class="ml-4 inline-block">• $1</span>');
    };

    return (
        <div className="w-full h-[calc(100%-44px)] overflow-hidden flex flex-col">
            {/* Title */}
            <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-gray-600">
                <h2 className="text-lg font-medium">Novion Agents</h2>
            </div>

            {/* Response Section - with user-select-text to make text selectable but not draggable */}
            <div className="flex-1 p-4 overflow-auto user-select-text">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-gray-500">Thinking...</p>
                    </div>
                ) : streamedResponse ? (
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md">
                        <div
                            className="text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ 
                                __html: formatResponseContent(streamedResponse)
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Enter a query.</p>
                    </div>
                )}
            </div>

            {/* Input Section */}
            <div className="p-4 border-t border-gray-300 dark:border-gray-600">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Enter your medical query (e.g., 'What is diabetic ketoacidosis?')"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !loading && handleQuerySubmit()}
                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                    <button
                        type="button"
                        onClick={handleQuerySubmit}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                        disabled={loading}
                    >
                        {loading ? "Working..." : "Ask Agents"}
                    </button>
                </div>
            </div>

            {/* Add styles to ensure text is selectable but not draggable */}
            <style jsx global>{`
                .user-select-text {
                    user-select: text;
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                    -webkit-user-drag: none;
                }
                
                .user-select-text * {
                    -webkit-user-drag: none;
                }
            `}</style>
        </div>
    );
}
