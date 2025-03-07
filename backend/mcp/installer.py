"""
MCP Installer integration for Novion.

This module provides functionality to install and manage additional MCP servers
using the @anaisbetts/mcp-installer package.
"""

import os
import json
import logging
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union

logger = logging.getLogger(__name__)

class MCPInstaller:
    """
    Manages MCP server installations via the mcp-installer package.
    """
    
    def __init__(self):
        """Initialize the MCP installer."""
        # Check for required dependencies
        self._check_dependencies()
        
        # Setup paths
        self.config_path = self._get_config_path()
    
    def _check_dependencies(self) -> None:
        """Check for required dependencies and log warnings if missing."""
        try:
            # Check for Node.js
            result = subprocess.run(["node", "--version"], 
                                   capture_output=True, text=True, check=False)
            if result.returncode != 0:
                logger.warning("Node.js is not installed. Some MCP servers may not be available.")
            
            # Check for npx
            result = subprocess.run(["npx", "--version"], 
                                   capture_output=True, text=True, check=False)
            if result.returncode != 0:
                logger.warning("npx is not installed. Some MCP servers may not be available.")
                
            # Check for uv (optional)
            result = subprocess.run(["uvx", "--version"], 
                                   capture_output=True, text=True, check=False)
            if result.returncode != 0:
                logger.info("uvx is not installed. Python-based MCP servers will use npx instead.")
        except Exception as e:
            logger.warning(f"Error checking dependencies: {e}")
    
    def _get_config_path(self) -> Path:
        """Get the path to the MCP servers configuration file."""
        # Default location based on platform
        if os.name == 'nt':  # Windows
            config_dir = Path(os.environ.get('APPDATA', '')) / 'Claude'
        elif os.name == 'posix':  # macOS/Linux
            if 'darwin' in os.sys.platform:  # macOS
                config_dir = Path.home() / 'Library' / 'Application Support' / 'Claude'
            else:  # Linux
                config_dir = Path.home() / '.config' / 'claude'
        else:
            # Fallback to a local config
            config_dir = Path.home() / '.Novion' / 'mcp'
        
        # Create config directory if it doesn't exist
        config_dir.mkdir(parents=True, exist_ok=True)
        
        return config_dir / 'mcp_config.json'
    
    def _load_config(self) -> Dict[str, Any]:
        """Load the MCP servers configuration file."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    return json.load(f)
            return {"mcpServers": {}}
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return {"mcpServers": {}}
    
    def _save_config(self, config: Dict[str, Any]) -> None:
        """Save the MCP servers configuration file."""
        try:
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
    
    async def install_mcp_server(self, 
                               server_name: str, 
                               args: Optional[List[str]] = None, 
                               env: Optional[List[str]] = None) -> str:
        """
        Install an MCP server using the mcp-installer.
        
        Args:
            server_name: The npm package name of the MCP server
            args: Optional arguments to pass to the server
            env: Optional environment variables to set (format: ["KEY=value",...])
            
        Returns:
            A message indicating the result of the installation
        """
        try:
            # Create a temporary script to install the server
            with tempfile.NamedTemporaryFile(suffix='.js', delete=False, mode='w') as f:
                script_path = f.name
                f.write(f"""
                const fs = require('fs');
                const path = require('path');
                const { execSync } = require('child_process');
                
                // Target server
                const serverName = "{server_name}";
                const serverArgs = {json.dumps(args or [])};
                const serverEnv = {json.dumps(env or [])};
                
                // Config path
                const configPath = "{str(self.config_path).replace('\\', '\\\\')}";
                
                // Function to check if Node.js is installed
                function hasNodeJs() {{
                    try {{
                        execSync('node --version');
                        return true;
                    }} catch (e) {{
                        return false;
                    }}
                }}
                
                // Function to check if a package exists
                function isNpmPackage(name) {{
                    try {{
                        execSync(`npm view ${{name}} version`);
                        return true;
                    }} catch (e) {{
                        return false;
                    }}
                }}
                
                // Install the server to config
                function installServer() {{
                    let config = {{}};
                    
                    try {{
                        if (fs.existsSync(configPath)) {{
                            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        }}
                    }} catch (e) {{
                        config = {{}};
                    }}
                    
                    // Format name for config (remove scope if present)
                    const formattedName = serverName.includes('/') ? serverName.split('/')[1] : serverName;
                    
                    // Convert env array to object
                    const envObj = {{}};
                    (serverEnv || []).forEach(item => {{
                        const [key, value] = item.split('=');
                        if (key) envObj[key] = value || '';
                    }});
                    
                    // Update config
                    const mcpServers = config.mcpServers || {{}};
                    mcpServers[formattedName] = {{
                        command: 'npx',
                        args: [serverName, ...serverArgs],
                        ...(Object.keys(envObj).length > 0 ? {{ env: envObj }} : {{}})
                    }};
                    
                    config.mcpServers = mcpServers;
                    
                    // Create directory if it doesn't exist
                    const configDir = path.dirname(configPath);
                    if (!fs.existsSync(configDir)) {{
                        fs.mkdirSync(configDir, {{ recursive: true }});
                    }}
                    
                    // Save config
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    console.log(`MCP server "${{formattedName}}" installed successfully.`);
                }}
                
                // Main execution
                if (!hasNodeJs()) {{
                    console.error('Node.js is not installed. Please install it to use this feature.');
                    process.exit(1);
                }}
                
                if (!isNpmPackage(serverName)) {{
                    console.error(`Package "${{serverName}}" not found on npm registry.`);
                    process.exit(1);
                }}
                
                // Install the server
                installServer();
                """)
            
            # Execute the installation script
            result = subprocess.run(["node", script_path], 
                                  capture_output=True, text=True, check=False)
            
            # Clean up the temporary file
            os.unlink(script_path)
            
            if result.returncode != 0:
                logger.error(f"Error installing MCP server: {result.stderr}")
                return f"Error installing MCP server: {result.stderr}"
            
            return f"MCP server '{server_name}' installed successfully. Please restart your application to use it."
            
        except Exception as e:
            logger.error(f"Error installing MCP server: {e}")
            return f"Error installing MCP server: {str(e)}"
    
    def list_installed_servers(self) -> Dict[str, Dict[str, Any]]:
        """
        List all installed MCP servers.
        
        Returns:
            A dictionary of server configurations
        """
        config = self._load_config()
        return config.get("mcpServers", {})
    
    def remove_server(self, server_name: str) -> bool:
        """
        Remove an installed MCP server.
        
        Args:
            server_name: The name of the server to remove
            
        Returns:
            True if the server was removed, False otherwise
        """
        try:
            config = self._load_config()
            servers = config.get("mcpServers", {})
            
            if server_name in servers:
                del servers[server_name]
                config["mcpServers"] = servers
                self._save_config(config)
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error removing server: {e}")
            return False

# Singleton instance
_installer_instance = None

def get_installer() -> MCPInstaller:
    """Get the singleton MCPInstaller instance."""
    global _installer_instance
    if _installer_instance is None:
        _installer_instance = MCPInstaller()
    return _installer_instance
