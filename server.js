const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');
const chokidar = require('chokidar');
const ejsLocals = require('ejs-locals');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure marked for better rendering
marked.setOptions({
  breaks: true,
  gfm: true
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
    const files = await fs.readdir(blogsDir);
    
    blogPosts.clear();
    blogSeries.clear();
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        await loadBlogPost(path.join(blogsDir, file));
      }
    }
    
    console.log(`Loaded ${blogPosts.size} blog posts`);
  } catch (error) {
    console.error('Error loading blog posts:', error);
  }
}

// Load individual blog post
async function loadBlogPost(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const { data: frontMatter, content: markdownContent } = matter(content);
    
    const fileName = path.basename(filePath, '.md');
    const htmlContent = marked(markdownContent);
    
    const post = {
      id: fileName,
      title: frontMatter.title || fileName,
      date: frontMatter.date || new Date().toISOString(),
      series: frontMatter.series || null,
      tags: frontMatter.tags || [],
      excerpt: frontMatter.excerpt || markdownContent.substring(0, 200) + '...',
      content: htmlContent,
      rawContent: markdownContent
    };
    
    blogPosts.set(fileName, post);
    
    // Group by series
    if (post.series) {
      if (!blogSeries.has(post.series)) {
        blogSeries.set(post.series, []);
      }
      blogSeries.get(post.series).push(post);
    }
  } catch (error) {
    console.error(`Error loading blog post ${filePath}:`, error);
  }
}

// Watch for changes in blogs directory
function watchBlogDirectory() {
  const blogsDir = path.join(__dirname, 'blogs');
  const watcher = chokidar.watch(blogsDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true
  });

  watcher
    .on('add', (filePath) => {
      if (filePath.endsWith('.md')) {
        console.log(`Blog post added: ${filePath}`);
        loadBlogPost(filePath);
      }
    })
    .on('change', (filePath) => {
      if (filePath.endsWith('.md')) {
        console.log(`Blog post changed: ${filePath}`);
        loadBlogPost(filePath);
      }
    })
    .on('unlink', (filePath) => {
      if (filePath.endsWith('.md')) {
        const fileName = path.basename(filePath, '.md');
        console.log(`Blog post removed: ${filePath}`);
        blogPosts.delete(fileName);
      }
    });
}

// Routes
app.get('/', (req, res) => {
  const recentPosts = Array.from(blogPosts.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  
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
  
  res.render('blog', { 
    title: 'Blog - Life & Mathematics',
    posts,
    series
  });
});

app.get('/blog/:id', (req, res) => {
  const post = blogPosts.get(req.params.id);
  
  if (!post) {
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

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found - Life & Mathematics'
  });
});

// Initialize
async function init() {
  // Create necessary directories
  try {
    await fs.mkdir('blogs', { recursive: true });
    await fs.mkdir('views', { recursive: true });
    await fs.mkdir('public/css', { recursive: true });
    await fs.mkdir('public/js', { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
  
  // Load initial blog posts
  await loadBlogPosts();
  
  // Start watching for changes
  watchBlogDirectory();
  
  // Start server
  app.listen(PORT, () => {
    console.log(`Academic blog server running on http://localhost:${PORT}`);
    console.log(`Watching for changes in ./blogs directory`);
  });
}

init();