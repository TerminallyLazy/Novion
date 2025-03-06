/**
 * Format response content with enhanced processing for thinking blocks and tool usage.
 * This handles markdown, thinking blocks, code formatting, and URL detection.
 */
export const formatResponseContent = (response: string) => {
    if (typeof response !== 'string') return "Invalid response format";
    
    // First, separate think sections from main content
    let thinkContent = "";
    let mainContent = response;
    
    // Extract think blocks
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const thinkMatches = mainContent.match(thinkRegex);
    
    if (thinkMatches) {
        // Remove think sections from main content
        mainContent = mainContent.replace(thinkRegex, '');
        
        // Process think blocks
        thinkMatches.forEach(block => {
            const content = block.replace(/<\/?think>/g, '');
            thinkContent += content + '\n';
        });
    }
    
    // HTML escaping function
    const escapeHtml = (text: string) => {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    
    // Process URLs and special patterns in both sections
    const processContent = (content: string) => {
        // Pre-process special patterns before escaping
        // Fix common malformed URL patterns
        let processed = content
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
        
        // Process markdown
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
    
    // Process both parts
    const formattedMain = processContent(mainContent);
    const formattedThink = thinkContent ? processContent(thinkContent) : '';
    
    // Combine with think section formatted as collapsible block
    if (formattedThink) {
        return `
            ${formattedThink ? `
                <div class="bg-gray-100 dark:bg-gray-700 p-2 mb-4 rounded border-l-4 border-blue-500">
                    <details>
                        <summary class="cursor-pointer font-semibold text-blue-600 dark:text-blue-300">Tool Usage & Thinking Process</summary>
                        <div class="mt-2 text-gray-700 dark:text-gray-300 pl-2 border-l-2 border-blue-300">
                            ${formattedThink}
                        </div>
                    </details>
                </div>
            ` : ''}
            ${formattedMain}
        `;
    } else {
        return formattedMain;
    }
};
