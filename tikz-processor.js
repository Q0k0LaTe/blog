// tikz-processor.js - Actual TikZ to SVG renderer
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawn } = require('child_process');

class TikZProcessor {
  constructor() {
    this.cacheDir = path.join(__dirname, 'public', 'tikz-cache');
    this.tempDir = path.join(__dirname, 'temp');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log('✓ TikZ directories ready');
    } catch (error) {
      console.error('Error creating TikZ directories:', error);
    }
  }

  // Generate a unique hash for TikZ code
  generateHash(tikzCode) {
    return crypto.createHash('md5').update(tikzCode.trim()).digest('hex');
  }

  // Method 1: Use QuickLaTeX online service to render TikZ
  async tikzToSvgOnline(tikzCode) {
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

    try {
      console.log(`🌐 Rendering TikZ online: ${hash}`);
      
      // Prepare the LaTeX document for QuickLaTeX
      const latexCode = `\\documentclass[border=2pt]{standalone}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usetikzlibrary{arrows,shapes,positioning,calc,decorations.pathreplacing,patterns}
\\begin{document}
${tikzCode}
\\end{document}`;

      // Use QuickLaTeX API
      const postData = new URLSearchParams({
        formula: latexCode,
        fsize: '17px',
        fcolor: '000000',
        mode: '0',
        out: '1',
        remhost: 'quicklatex.com',
        rnd: Math.random().toString()
      }).toString();

      const result = await this.makeHttpRequest('https://quicklatex.com/latex3.f', postData);
      
      if (result.startsWith('0\r\n')) {
        // Success - extract the image URL
        const lines = result.split('\r\n');
        if (lines.length >= 2) {
          const imageUrl = lines[1];
          console.log(`✓ QuickLaTeX generated image: ${imageUrl}`);
          
          // Download the image and convert to SVG
          const svgContent = await this.downloadAndConvertToSvg(imageUrl);
          await fs.writeFile(svgPath, svgContent);
          
          return `/tikz-cache/${hash}.svg`;
        }
      }
      
      throw new Error(`QuickLaTeX error: ${result}`);
      
    } catch (error) {
      console.error(`❌ Online TikZ rendering failed:`, error);
      return this.tikzToSvgLocal(tikzCode);
    }
  }

  // Method 2: Local rendering using LaTeX (if available)
  async tikzToSvgLocal(tikzCode) {
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

    try {
      console.log(`🔧 Rendering TikZ locally: ${hash}`);
      
      // Check if we have the required tools
      const hasLatex = await this.checkCommand('pdflatex');
      const hasPdf2svg = await this.checkCommand('pdf2svg');
      
      if (!hasLatex || !hasPdf2svg) {
        console.log('⚠️ Local LaTeX tools not available, using fallback');
        return this.createRenderingFallback(tikzCode);
      }
      
      // Create LaTeX document
      const latexContent = `\\documentclass[tikz,border=2pt]{standalone}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usetikzlibrary{arrows,shapes,positioning,calc,decorations.pathreplacing,patterns}
\\begin{document}
${tikzCode}
\\end{document}`;

      const texFile = path.join(this.tempDir, `${hash}.tex`);
      const pdfFile = path.join(this.tempDir, `${hash}.pdf`);
      
      // Write LaTeX file
      await fs.writeFile(texFile, latexContent);
      
      // Compile LaTeX to PDF
      await this.runCommand('pdflatex', [
        '-interaction=nonstopmode',
        '-output-directory', this.tempDir,
        texFile
      ]);
      
      // Convert PDF to SVG
      await this.runCommand('pdf2svg', [pdfFile, svgPath]);
      
      // Clean up temporary files
      await this.cleanup(hash);
      
      console.log(`✓ Generated TikZ SVG locally: ${hash}.svg`);
      return `/tikz-cache/${hash}.svg`;
      
    } catch (error) {
      console.error(`❌ Local TikZ rendering failed:`, error);
      return this.createRenderingFallback(tikzCode);
    }
  }

  // Method 3: Fallback using a simpler TikZ-to-SVG library (tikzit or similar simulation)
  async createRenderingFallback(tikzCode) {
    const hash = this.generateHash(tikzCode);
    const svgPath = path.join(this.cacheDir, `fallback-${hash}.svg`);
    
    try {
      console.log(`🎨 Creating TikZ fallback render: ${hash}`);
      
      // Basic TikZ command parser for simple diagrams
      const svg = this.parseBasicTikzToSvg(tikzCode);
      await fs.writeFile(svgPath, svg);
      
      return `/tikz-cache/fallback-${hash}.svg`;
    } catch (error) {
      console.error('Fallback rendering failed:', error);
      return this.createErrorSvg(tikzCode);
    }
  }

  // Basic TikZ parser for simple geometric shapes
  parseBasicTikzToSvg(tikzCode) {
    let svgContent = '';
    const commands = tikzCode.split(';').filter(cmd => cmd.trim());
    
    // Set up SVG viewBox - we'll adjust based on coordinates found
    let minX = 0, minY = 0, maxX = 400, maxY = 300;
    
    // Parse basic drawing commands
    for (const command of commands) {
      const cmd = command.trim();
      
      // Parse \draw commands
      if (cmd.includes('\\draw')) {
        // Extract coordinates and draw lines
        const coordPattern = /\(([-\d.]+),([-\d.]+)\)/g;
        const coords = [];
        let match;
        
        while ((match = coordPattern.exec(cmd)) !== null) {
          const x = parseFloat(match[1]) * 50 + 200; // Scale and center
          const y = 200 - parseFloat(match[2]) * 50; // Flip Y and scale
          coords.push({ x, y });
          
          // Update bounds
          minX = Math.min(minX, x - 20);
          maxX = Math.max(maxX, x + 20);
          minY = Math.min(minY, y - 20);
          maxY = Math.max(maxY, y + 20);
        }
        
        if (coords.length >= 2) {
          // Draw lines between coordinates
          if (cmd.includes('--')) {
            const pathData = coords.map((coord, i) => 
              i === 0 ? `M ${coord.x} ${coord.y}` : `L ${coord.x} ${coord.y}`
            ).join(' ');
            
            // Check for cycle to close the path
            if (cmd.includes('cycle')) {
              svgContent += `<path d="${pathData} Z" fill="none" stroke="#2d2d2d" stroke-width="2"/>\n`;
            } else {
              svgContent += `<path d="${pathData}" fill="none" stroke="#2d2d2d" stroke-width="2"/>\n`;
            }
          }
          
          // Add circles at coordinates if specified
          if (cmd.includes('circle')) {
            coords.forEach(coord => {
              svgContent += `<circle cx="${coord.x}" cy="${coord.y}" r="3" fill="#8B4513"/>\n`;
            });
          }
        }
      }
      
      // Parse \node commands for labels
      if (cmd.includes('\\node')) {
        const nodeMatch = cmd.match(/\\node\[([^\]]*)\]\s*at\s*\(([-\d.]+),([-\d.]+)\)\s*\{([^}]+)\}/);
        if (nodeMatch) {
          const x = parseFloat(nodeMatch[2]) * 50 + 200;
          const y = 200 - parseFloat(nodeMatch[3]) * 50;
          const text = nodeMatch[4];
          const position = nodeMatch[1];
          
          let textAnchor = 'middle';
          let dy = '0.35em';
          
          if (position.includes('below')) dy = '1.2em';
          if (position.includes('above')) dy = '-0.5em';
          if (position.includes('left')) textAnchor = 'end';
          if (position.includes('right')) textAnchor = 'start';
          
          svgContent += `<text x="${x}" y="${y}" text-anchor="${textAnchor}" dy="${dy}" font-family="serif" font-size="14" fill="#2d2d2d">${text}</text>\n`;
        }
      }
    }
    
    // Create the complete SVG
    const width = maxX - minX;
    const height = maxY - minY;
    
    return `<svg width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: 'EB Garamond', serif; }
  </style>
  ${svgContent}
</svg>`;
  }

  // HTTP request helper
  makeHttpRequest(url, postData) {
    return new Promise((resolve, reject) => {
      const options = new URL(url);
      options.method = 'POST';
      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // Download image and convert to SVG
  async downloadAndConvertToSvg(imageUrl) {
    return new Promise((resolve, reject) => {
      https.get(imageUrl, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // For now, embed as base64 image in SVG
          const base64 = buffer.toString('base64');
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="data:image/png;base64,${base64}" width="100%" height="100%"/>
</svg>`;
          resolve(svg);
        });
      }).on('error', reject);
    });
  }

  // Check if command exists
  async checkCommand(command) {
    try {
      await this.runCommand(command, ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  // Run shell command
  runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`${command} failed: ${stderr}`));
        }
      });
    });
  }

  // Clean up temporary files
  async cleanup(hash) {
    try {
      const extensions = ['.tex', '.pdf', '.aux', '.log', '.fls', '.fdb_latexmk'];
      for (const ext of extensions) {
        try {
          await fs.unlink(path.join(this.tempDir, `${hash}${ext}`));
        } catch {
          // File might not exist, ignore
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // Create error SVG
  createErrorSvg(tikzCode) {
    const hash = this.generateHash(tikzCode);
    const errorSvg = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="200" fill="#ffebee" stroke="#f44336" stroke-width="2" rx="4"/>
  <text x="200" y="80" text-anchor="middle" font-family="serif" font-size="16" fill="#d32f2f">
    TikZ Rendering Failed
  </text>
  <text x="200" y="120" text-anchor="middle" font-family="monospace" font-size="12" fill="#757575">
    Hash: ${hash.substring(0, 12)}
  </text>
  <text x="200" y="150" text-anchor="middle" font-family="serif" font-size="11" fill="#999" font-style="italic">
    Check TikZ syntax or server logs
  </text>
</svg>`;
    
    const svgPath = path.join(this.cacheDir, `error-${hash}.svg`);
    fs.writeFile(svgPath, errorSvg).catch(console.error);
    return `/tikz-cache/error-${hash}.svg`;
  }

  // Main processing function
  async processTikzCode(tikzCode) {
    try {
      // Try online rendering first (most reliable)
      try {
        return await this.tikzToSvgOnline(tikzCode);
      } catch (onlineError) {
        console.log('Online rendering failed, trying local...');
        
        // Try local rendering
        try {
          return await this.tikzToSvgLocal(tikzCode);
        } catch (localError) {
          console.log('Local rendering failed, using fallback parser...');
          
          // Use basic fallback parser
          return await this.createRenderingFallback(tikzCode);
        }
      }
    } catch (error) {
      console.error('All TikZ rendering methods failed:', error);
      return this.createErrorSvg(tikzCode);
    }
  }
}

module.exports = TikZProcessor;