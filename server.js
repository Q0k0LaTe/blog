import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import matter from 'gray-matter';
import chokidar from 'chokidar';
import ejsLocals from 'ejs-locals';
import TikZProcessor from './tikz-processor.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const tikzProcessor = new TikZProcessor();

// Pre-process markdown to extract and render TikZ blocks server-side
async function preprocessMarkdownWithTikz(markdownContent) {
  console.log('🔄 Pre-processing markdown for TikZ blocks...');
  
  // Find all TikZ code blocks
  const tikzRegex = /```tikz\n([\s\S]*?)\n```/g;
  const tikzBlocks = [];
  let match;
  
  // Extract all TikZ blocks
  while ((match = tikzRegex.exec(markdownContent)) !== null) {
    const tikzCode = match[1];
    const fullMatch = match[0];
    tikzBlocks.push({ tikzCode, fullMatch });
    console.log(`📝 Found TikZ block: ${tikzCode.substring(0, 50)}...`);
  }
  
  if (tikzBlocks.length === 0) {
    console.log('✓ No TikZ blocks found, proceeding with normal markdown');
    return markdownContent;
  }
  
  console.log(`🎨 Processing ${tikzBlocks.length} TikZ block(s)...`);
  
  // Process each TikZ block and get image paths
  let processedMarkdown = markdownContent;
  
  for (const { tikzCode, fullMatch } of tikzBlocks) {
    try {
      console.log(`🔧 Rendering TikZ diagram...`);
      const imagePath = await tikzProcessor.processTikzCode(tikzCode);
      
      // Replace the TikZ code block with HTML img tag
      const imageHtml = `<div class="tikz-container">
  <img src="${imagePath}" alt="TikZ Diagram" class="tikz-image" />
</div>`;
      
      processedMarkdown = processedMarkdown.replace(fullMatch, imageHtml);
      console.log(`✅ TikZ block rendered and replaced with: ${imagePath}`);
      
    } catch (error) {
      console.error(`❌ Failed to render TikZ block:`, error);
      
      // Replace with error message
      const errorHtml = `<div class="tikz-container tikz-error">
  <p>❌ TikZ Rendering Error</p>
  <pre><code>${tikzCode}</code></pre>
  <small>Error: ${error.message}</small>
</div>`;
      processedMarkdown = processedMarkdown.replace(fullMatch, errorHtml);
    }
  }
  
  console.log('✅ TikZ pre-processing complete');
  return processedMarkdown;
}

// Configure marked for standard rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false
});

// Serve static files
app.use(express.static('public'));
app.engine('ejs', ejsLocals);
app.set('view engine', 'ejs');
app.set('views', './views');

// Store blog posts in memory
let blogPosts = new Map();
let blogSeries = new Map();

// Load all blog posts from /blogs directory
async function loadBlogPosts() {
  try {
    const blogsDir = path.join(__dirname, 'blogs');
    
    // Check if blogs directory exists
    try {
      await fs.access(blogsDir);
    } catch {
      console.log('Creating blogs directory...');
      await fs.mkdir(blogsDir, { recursive: true });
    }
    
    const files = await fs.readdir(blogsDir);
    console.log(`Found ${files.length} files in blogs directory:`, files);
    
    blogPosts.clear();
    blogSeries.clear();
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        console.log(`Loading blog post: ${file}`);
        await loadBlogPost(path.join(blogsDir, file));
      }
    }
    
    console.log(`✓ Successfully loaded ${blogPosts.size} blog posts`);
    if (blogSeries.size > 0) {
      console.log(`✓ Found ${blogSeries.size} blog series:`, Array.from(blogSeries.keys()));
    }
  } catch (error) {
    console.error('❌ Error loading blog posts:', error);
  }
}

// Load individual blog post with server-side TikZ processing
async function loadBlogPost(filePath) {
  try {
    console.log(`📖 Reading file: ${filePath}`);
    const content = await fs.readFile(filePath, 'utf8');
    
    if (!content.trim()) {
      console.warn(`⚠️  File ${filePath} is empty`);
      return;
    }
    
    const { data: frontMatter, content: markdownContent } = matter(content);
    console.log(`📋 Parsed frontmatter for ${path.basename(filePath)}:`, frontMatter);
    
    const fileName = path.basename(filePath, '.md');
    
    // STEP 1: Pre-process markdown to handle TikZ blocks
    console.log(`🔄 Pre-processing TikZ for: ${fileName}`);
    const processedMarkdown = await preprocessMarkdownWithTikz(markdownContent);
    
    // STEP 2: Convert processed markdown to HTML
    console.log(`🔄 Converting markdown to HTML: ${fileName}`);
    const htmlContent = marked(processedMarkdown);
    
    const post = {
      id: fileName,
      title: frontMatter.title || fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      date: frontMatter.date || new Date().toISOString().split('T')[0],
      series: frontMatter.series || null,
      tags: frontMatter.tags || [],
      excerpt: frontMatter.excerpt || markdownContent.substring(0, 200).replace(/[#*]/g, '') + '...',
      content: htmlContent,
      rawContent: markdownContent
    };
    
    // Remove old post from series if it exists (to prevent duplicates)
    if (blogPosts.has(fileName)) {
      const oldPost = blogPosts.get(fileName);
      if (oldPost.series && blogSeries.has(oldPost.series)) {
        const seriesPosts = blogSeries.get(oldPost.series);
        const index = seriesPosts.findIndex(p => p.id === fileName);
        if (index > -1) {
          seriesPosts.splice(index, 1);
          if (seriesPosts.length === 0) {
            blogSeries.delete(oldPost.series);
          }
        }
      }
    }
    
    blogPosts.set(fileName, post);
    console.log(`✅ Loaded post: "${post.title}"`);
    
    // Group by series (only add if not already present)
    if (post.series) {
      if (!blogSeries.has(post.series)) {
        blogSeries.set(post.series, []);
      }
      const seriesPosts = blogSeries.get(post.series);
      // Check if post already exists in series
      const existingIndex = seriesPosts.findIndex(p => p.id === post.id);
      if (existingIndex > -1) {
        // Update existing post
        seriesPosts[existingIndex] = post;
      } else {
        // Add new post
        seriesPosts.push(post);
      }
      console.log(`📚 Added to series: ${post.series} (${seriesPosts.length} posts)`);
    }
  } catch (error) {
    console.error(`❌ Error loading blog post ${filePath}:`, error);
  }
}

// Watch for changes in blogs directory
function watchBlogDirectory() {
  const blogsDir = path.join(__dirname, 'blogs');
  
  try {
    const watcher = chokidar.watch(blogsDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    watcher
      .on('add', (filePath) => {
        if (filePath.endsWith('.md')) {
          console.log(`📝 Blog post added: ${filePath}`);
          loadBlogPost(filePath);
        }
      })
      .on('change', (filePath) => {
        if (filePath.endsWith('.md')) {
          console.log(`📝 Blog post changed: ${filePath}`);
          loadBlogPost(filePath);
        }
      })
      .on('unlink', (filePath) => {
        if (filePath.endsWith('.md')) {
          const fileName = path.basename(filePath, '.md');
          console.log(`🗑️  Blog post removed: ${filePath}`);
          blogPosts.delete(fileName);
        }
      })
      .on('error', error => {
        console.error('❌ Watcher error:', error);
      });
      
    console.log(`👀 Watching for changes in: ${blogsDir}`);
  } catch (error) {
    console.error('❌ Error setting up file watcher:', error);
  }
}

// Routes
app.get('/', (req, res) => {
  const recentPosts = Array.from(blogPosts.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  
  console.log(`Homepage requested. Showing ${recentPosts.length} recent posts`);
  
  res.render('index', { 
    title: 'Life & Mathematics',
    recentPosts,
    totalPosts: blogPosts.size
  });
});

app.get('/about', (req, res) => {
  res.render('about', { 
    title: 'About - Life & Mathematics'
  });
});

app.get('/blog', (req, res) => {
  const posts = Array.from(blogPosts.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const series = Array.from(blogSeries.entries()).map(([name, posts]) => ({
    name,
    posts: posts.sort((a, b) => new Date(b.date) - new Date(a.date)),
    count: posts.length
  }));
  
  console.log(`Blog page requested. Found ${posts.length} posts and ${series.length} series`);
  
  res.render('blog', { 
    title: 'Blog - Life & Mathematics',
    posts,
    series
  });
});

app.get('/blog/:id', (req, res) => {
  const post = blogPosts.get(req.params.id);
  
  if (!post) {
    console.log(`❌ Post not found: ${req.params.id}`);
    console.log('Available posts:', Array.from(blogPosts.keys()));
    return res.status(404).render('404', { 
      title: 'Post Not Found - Life & Mathematics'
    });
  }
  
  // Get related posts from same series
  let relatedPosts = [];
  if (post.series) {
    relatedPosts = blogSeries.get(post.series)
      .filter(p => p.id !== post.id)
      .slice(0, 3);
  }
  
  console.log(`✓ Serving post: ${post.title}`);
  
  res.render('post', { 
    title: `${post.title} - Life & Mathematics`,
    post,
    relatedPosts
  });
});

app.get('/series/:name', (req, res) => {
  const seriesName = req.params.name;
  const posts = blogSeries.get(seriesName);
  
  if (!posts) {
    console.log(`❌ Series not found: ${seriesName}`);
    console.log('Available series:', Array.from(blogSeries.keys()));
    return res.status(404).render('404', { 
      title: 'Series Not Found - Life & Mathematics'
    });
  }
  
  const sortedPosts = posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.render('series', { 
    title: `${seriesName} Series - Life & Mathematics`,
    seriesName,
    posts: sortedPosts
  });
});

// Debug route to test TikZ rendering
app.get('/debug/tikz-test', async (req, res) => {
  const testTikz = `\\begin{tikzpicture}
\\draw (0,0) -- (2,0) -- (1,1.7) -- cycle;
\\node[below] at (0,0) {A};
\\node[below] at (2,0) {B};
\\node[above] at (1,1.7) {C};
\\end{tikzpicture}`;

  try {
    const svgPath = await tikzProcessor.processTikzCode(testTikz);
    
    // Return HTML page showing the result
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>TikZ Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
        .result { margin: 2rem 0; padding: 1rem; border: 1px solid #ccc; }
        .success { border-color: #4caf50; background: #f0fff0; }
        .error { border-color: #f44336; background: #fff0f0; }
        img { max-width: 100%; border: 1px solid #ddd; }
        pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>TikZ Test Results</h1>
    
    <h2>Input TikZ Code:</h2>
    <pre><code>${testTikz}</code></pre>
    
    <h2>Result:</h2>
    <div class="result success">
        <p><strong>✓ Success!</strong> TikZ rendered successfully</p>
        <p><strong>SVG Path:</strong> ${svgPath}</p>
        <p><strong>Rendered Image:</strong></p>
        <img src="${svgPath}" alt="TikZ Triangle" />
    </div>
    
    <p><a href="/blog">← Back to Blog</a></p>
</body>
</html>
    `);
  } catch (error) {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>TikZ Test - Error</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
        .result { margin: 2rem 0; padding: 1rem; border: 1px solid #ccc; }
        .error { border-color: #f44336; background: #fff0f0; }
        pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>TikZ Test Results</h1>
    
    <h2>Input TikZ Code:</h2>
    <pre><code>${testTikz}</code></pre>
    
    <h2>Result:</h2>
    <div class="result error">
        <p><strong>❌ Error!</strong> TikZ rendering failed</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <pre><code>${error.stack}</code></pre>
    </div>
    
    <p><a href="/blog">← Back to Blog</a></p>
</body>
</html>
    `);
  }
});

// Debug route to check loaded posts
app.get('/debug/posts', (req, res) => {
  res.json({
    postsCount: blogPosts.size,
    posts: Array.from(blogPosts.entries()),
    seriesCount: blogSeries.size,
    series: Array.from(blogSeries.entries())
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found - Life & Mathematics'
  });
});

// Initialize
async function init() {
  console.log('🚀 Initializing Academic Blog Server...');
  
  // Create necessary directories
  try {
    await fs.mkdir('blogs', { recursive: true });
    await fs.mkdir('views', { recursive: true });
    await fs.mkdir('public/css', { recursive: true });
    await fs.mkdir('public/js', { recursive: true });
    console.log('✓ Directories created/verified');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
  }
  
  // Load initial blog posts
  await loadBlogPosts();
  
  // Start watching for changes
  watchBlogDirectory();
  
  // Start server
  app.listen(PORT, () => {
    console.log('');
    console.log('🎓 Academic Blog Server Started!');
    console.log(`📖 Server running at: http://localhost:${PORT}`);
    console.log(`📁 Blog posts: ${blogPosts.size} loaded`);
    console.log(`📚 Series: ${blogSeries.size} found`);
    console.log(`👀 Watching: ./blogs directory`);
    console.log('');
    console.log('💡 Quick start:');
    console.log('   - Visit http://localhost:3000 to see your blog');
    console.log('   - Add .md files to ./blogs/ directory');
    console.log('   - Test TikZ at http://localhost:3000/debug/tikz-test');
    console.log('   - Check posts at http://localhost:3000/debug/posts');
    console.log('');
  });
}

init();