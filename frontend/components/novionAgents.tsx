import { useState, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import FHIRTools from "./FHIRTools";

interface Tool {
    name: string;
    description: string;
    type: string;
    category: string;
}

export default function NovionAgent() {
    const [query, setQuery] = useState(""); // User input state
    const [loading, setLoading] = useState(false); // Loading state
    const [streamedResponse, setStreamedResponse] = useState<string>(""); // Streamed response state
    const [availableTools, setAvailableTools] = useState<Tool[]>([]); // Available MCP tools
    const [selectedTool, setSelectedTool] = useState<string>(""); // Selected tool for direct use
    const [toolParams, setToolParams] = useState<string>(""); // Parameters for direct tool use
    const [showTools, setShowTools] = useState<boolean>(false); // Toggle tool display
    
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
    
    // Fetch available tools when component mounts
    useEffect(() => {
        fetchAvailableTools();
    }, []);
    
    // Fetch available MCP tools from the backend
    const fetchAvailableTools = async () => {
        try {
            const response = await fetch('http://localhost:8000/tools');
            if (response.ok) {
                const tools = await response.json();
                setAvailableTools(tools);
                console.log("Available tools:", tools);
            } else {
                console.error("Failed to fetch tools:", response.statusText);
            }
        } catch (error) {
            console.error("Error fetching tools:", error);
        }
    };
    
    // Function to handle direct tool execution
    const handleToolExecution = async () => {
        if (!selectedTool) return; // Prevent execution without a selected tool
        
        // Clear previous responses and set loading state
        setStreamedResponse("");
        setLoading(true);
        
        try {
            // Execute the tool via the tools endpoint
            const response = await fetch('http://localhost:8000/execute_tool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tool_name: selectedTool,
                    params: toolParams ? JSON.parse(toolParams) : {}
                }),
            });
            
            const result = await response.text();
            setStreamedResponse(result);
            setLoading(false);
        } catch (error) {
            console.error("Tool execution error:", error);
            setLoading(false);
            setStreamedResponse(`Error executing tool: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    
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

    // Function that executes a specific MCP tool with provided parameters
    const executeMCPTool = async (toolName: string, params: any) => {
        try {
            const response = await fetch('http://localhost:8000/execute_tool', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tool_name: toolName,
                    params: params
                }),
            });
            
            const result = await response.text();
            try {
                return JSON.parse(result);
            } catch {
                return result;
            }
        } catch (error) {
            console.error("Tool execution error:", error);
            throw error;
        }
    };

    return (
        <div className="w-full h-[calc(100%-44px)] overflow-hidden flex flex-col">
            {/* Title */}
            {/* <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-gray-600">
                <h2 className="text-lg font-medium">Novion Agents</h2>
            </div> */}

            {/* Main Content */}
            <Tabs defaultValue="query" className="flex-1 flex flex-col">
                <div className="border-b border-gray-300 dark:border-gray-600">
                    <TabsList className="m-2">
                        <TabsTrigger value="query">Medical Query</TabsTrigger>
                        <TabsTrigger value="fhir">FHIR Tools</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="query" className="flex-1 overflow-auto">
                    {/* Response Section - with user-select-text to make text selectable but not draggable */}
                    <div className="p-4 h-full overflow-auto user-select-text">
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
                                <p className="text-gray-500">Enter a medical query to get started.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
                
                <TabsContent value="fhir" className="flex-1 overflow-auto p-4">
                    <FHIRTools onToolExecution={executeMCPTool} />
                </TabsContent>
            </Tabs>

            {/* Tools Panel (conditionally rendered) */}
            {showTools && (
                <div className="p-4 border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-850">
                    <h3 className="text-md font-medium mb-3">Direct MCP Tool Access</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Tool</label>
                            <select
                                value={selectedTool}
                                onChange={(e) => setSelectedTool(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            >
                                <option value="">-- Select a tool --</option>
                                {Array.isArray(availableTools) ? availableTools.map(tool => (
                                    <option key={tool.name} value={tool.name}>
                                        {tool.name} ({tool.category})
                                    </option>
                                )) : null}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tool Parameters (JSON)</label>
                            <textarea
                                value={toolParams}
                                onChange={(e) => setToolParams(e.target.value)}
                                placeholder="{'param1': 'value1', 'param2': 'value2'}"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md h-24 font-mono text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleToolExecution}
                            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition w-full"
                            disabled={loading || !selectedTool}
                        >
                            {loading ? "Executing..." : "Execute Tool"}
                        </button>
                    </div>
                    {selectedTool && (
                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                            <p className="font-medium">Tool Description:</p>
                            <p>{availableTools.find(t => t.name === selectedTool)?.description || "No description available"}</p>
                        </div>
                    )}
                </div>
            )}
            
            {/* Input Section */}
            <div className="p-4 border-t border-gray-300 dark:border-gray-600">
                <div className="flex space-x-2 mb-2">
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
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition min-w-24"
                        disabled={loading}
                    >
                        {loading ? "Working..." : "Ask Agents"}
                    </button>
                </div>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowTools(!showTools)}
                        className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                    >
                        {showTools ? "Hide MCP Tools" : "Show MCP Tools"}
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showTools ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                        </svg>
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
