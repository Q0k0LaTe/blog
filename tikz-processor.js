// tikz-processor.js - TikZ processor using node-tikzjax
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TikZProcessor {
  constructor() {
    this.cacheDir = path.join(__dirname, 'public', 'tikz-cache');
    this.tikzjaxAvailable = false;
    this.init();
  }

  async init() {
    await this.ensureDirectories();
    await this.checkTikzjaxAvailability();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log('✓ TikZ cache directory ready');
    } catch (error) {
      console.error('Error creating TikZ directories:', error);
    }
  }

  async checkTikzjaxAvailability() {
    try {
      // Dynamically import node-tikzjax
      console.log('Attempting to load node-tikzjax...');
      const tikzjaxModule = await import('node-tikzjax');
      this.tex2svg = tikzjaxModule.default;
      this.tikzjaxAvailable = true;
      console.log('✓ node-tikzjax loaded successfully');
      
      // Test the module with a simple example
      try {
        const testLatex = `\\documentclass{standalone}
\\usepackage{tikz}
\\begin{document}
\\begin{tikzpicture}
\\draw (0,0) circle (1cm);
\\end{tikzpicture}
\\end{document}`;
        
        console.log('Testing node-tikzjax with simple circle...');
        const testSvg = await this.tex2svg(testLatex);
        console.log('✓ node-tikzjax test successful');
      } catch (testError) {
        console.warn('⚠️ node-tikzjax test failed:', testError.message);
        this.tikzjaxAvailable = false;
      }
      
    } catch (error) {
      console.log('⚠️ node-tikzjax not available:', error.message);
      console.log('Install with: npm install node-tikzjax');
      this.tikzjaxAvailable = false;
    }
  }

  // Generate a unique hash for TikZ code
  generateHash(tikzCode) {
    return crypto.createHash('md5').update(tikzCode.trim()).digest('hex');
  }

  // Process TikZ code using node-tikzjax
  async processTikzCode(tikzCode) {
    const hash = this.generateHash(tikzCode);
    const svgPath = path.join(this.cacheDir, `${hash}.svg`);
    
    // Check if SVG already exists in cache
    try {
      await fs.access(svgPath);
      console.log(`✓ Using cached TikZ: ${hash}.svg`);
      return `/tikz-cache/${hash}.svg`;
    } catch {
      // SVG doesn't exist, need to generate it
    }

    if (!this.tikzjaxAvailable) {
      console.log('Using fallback renderer...');
      return this.createFallbackSvg(tikzCode, hash);
    }

    try {
      console.log(`🎨 Rendering TikZ with node-tikzjax: ${hash}`);
      
      // Wrap TikZ code in a complete LaTeX document as required by node-tikzjax
      const latexSource = `\\documentclass{standalone}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usetikzlibrary{arrows,shapes,positioning,calc,decorations.pathreplacing,patterns}
\\begin{document}
${tikzCode}
\\end{document}`;

      console.log('Processing LaTeX source with node-tikzjax...');
      
      // Generate SVG using node-tikzjax with options
      const svg = await this.tex2svg(latexSource, {
        showConsole: false,
        tikzLibraries: 'arrows,shapes,positioning,calc,decorations.pathreplacing,patterns',
        embedFontCss: false,
        disableOptimize: false
      });
      
      // Save the SVG to cache
      await fs.writeFile(svgPath, svg);
      
      console.log(`✅ TikZ rendered successfully: ${hash}.svg`);
      return `/tikz-cache/${hash}.svg`;
      
    } catch (error) {
      console.error(`❌ TikZ rendering failed:`, error);
      console.error('Error details:', error.message);
      return this.createFallbackSvg(tikzCode, hash);
    }
  }

  // Create a fallback SVG for simple TikZ commands
  async createFallbackSvg(tikzCode, hash) {
    const fallbackPath = path.join(this.cacheDir, `fallback-${hash}.svg`);
    
    try {
      console.log(`🎨 Creating fallback SVG: ${hash}`);
      
      // Simple TikZ parser for basic shapes
      const svg = this.parseBasicTikzToSvg(tikzCode);
      await fs.writeFile(fallbackPath, svg);
      
      console.log(`✅ Fallback SVG created: fallback-${hash}.svg`);
      return `/tikz-cache/fallback-${hash}.svg`;
      
    } catch (error) {
      console.error(`❌ Error creating fallback:`, error);
      return this.createErrorSvg(tikzCode, hash);
    }
  }

  // Basic TikZ parser for simple geometric shapes
  parseBasicTikzToSvg(tikzCode) {
    let svgElements = [];
    const commands = tikzCode.split(';').filter(cmd => cmd.trim());
    
    // SVG setup
    const scale = 50;
    const centerX = 200;
    const centerY = 150;
    let minX = 50, minY = 50, maxX = 350, maxY = 250;
    
    for (const command of commands) {
      const cmd = command.trim();
      
      // Parse \draw commands for lines and shapes
      if (cmd.includes('\\draw')) {
        // Extract coordinates
        const coordPattern = /\(([-\d.]+),([-\d.]+)\)/g;
        const coords = [];
        let match;
        
        while ((match = coordPattern.exec(cmd)) !== null) {
          const x = parseFloat(match[1]) * scale + centerX;
          const y = centerY - parseFloat(match[2]) * scale; // Flip Y axis
          coords.push({ x, y });
          
          // Update bounds
          minX = Math.min(minX, x - 20);
          maxX = Math.max(maxX, x + 20);
          minY = Math.min(minY, y - 20);
          maxY = Math.max(maxY, y + 20);
        }
        
        if (coords.length >= 2) {
          if (cmd.includes('--')) {
            // Draw lines
            const pathData = coords.map((coord, i) => 
              i === 0 ? `M ${coord.x} ${coord.y}` : `L ${coord.x} ${coord.y}`
            ).join(' ');
            
            const closePath = cmd.includes('cycle') ? ' Z' : '';
            const strokeColor = cmd.includes('[blue]') ? '#0066cc' : '#2d2d2d';
            const strokeWidth = cmd.includes('thick') ? '3' : '2';
            
            svgElements.push(`<path d="${pathData}${closePath}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);
          }
          
          // Handle circles
          if (cmd.includes('circle')) {
            coords.forEach(coord => {
              const radiusMatch = cmd.match(/circle\s*\(([-\d.]+)(?:cm|pt|in)?\)/);
              const radius = radiusMatch ? parseFloat(radiusMatch[1]) * scale : 20;
              svgElements.push(`<circle cx="${coord.x}" cy="${coord.y}" r="${radius}" fill="none" stroke="#2d2d2d" stroke-width="2"/>`);
            });
          }
        }
      }
      
      // Parse \node commands for text labels
      if (cmd.includes('\\node')) {
        const nodeMatch = cmd.match(/\\node\[([^\]]*)\]\s*at\s*\(([-\d.]+),([-\d.]+)\)\s*\{([^}]+)\}/);
        if (nodeMatch) {
          const position = nodeMatch[1];
          const x = parseFloat(nodeMatch[2]) * scale + centerX;
          const y = centerY - parseFloat(nodeMatch[3]) * scale;
          const text = nodeMatch[4];
          
          let textAnchor = 'middle';
          let dy = '0.35em';
          
          if (position.includes('below')) dy = '1.2em';
          if (position.includes('above')) dy = '-0.5em';
          if (position.includes('left')) textAnchor = 'end';
          if (position.includes('right')) textAnchor = 'start';
          
          svgElements.push(`<text x="${x}" y="${y}" text-anchor="${textAnchor}" dy="${dy}" font-family="serif" font-size="16" fill="#2d2d2d">${text}</text>`);
        }
      }
    }
    
    // Create complete SVG
    const width = Math.max(400, maxX - minX + 40);
    const height = Math.max(300, maxY - minY + 40);
    const viewBox = `${minX - 20} ${minY - 20} ${width} ${height}`;
    
    return `<svg width="${width}" height="${height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: 'EB Garamond', serif; }
  </style>
  ${svgElements.join('\n  ')}
</svg>`;
  }

  // Create error SVG
  async createErrorSvg(tikzCode, hash) {
    const errorPath = path.join(this.cacheDir, `error-${hash}.svg`);
    
    const errorSvg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="200" fill="#ffebee" stroke="#f44336" stroke-width="2" rx="4"/>
  <text x="200" y="80" text-anchor="middle" font-family="serif" font-size="16" fill="#d32f2f">
    TikZ Rendering Failed
  </text>
  <text x="200" y="120" text-anchor="middle" font-family="monospace" font-size="12" fill="#757575">
    Hash: ${hash.substring(0, 12)}
  </text>
  <text x="200" y="150" text-anchor="middle" font-family="serif" font-size="11" fill="#999">
    Check TikZ syntax or install node-tikzjax
  </text>
</svg>`;
    
    await fs.writeFile(errorPath, errorSvg);
    return `/tikz-cache/error-${hash}.svg`;
  }
}

export default TikZProcessor;