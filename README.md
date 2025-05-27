# Academic Blog Server

A classical academic-style Node.js blog with automatic markdown synchronization, designed for mathematicians, researchers, and academics.

## Features

- 🎓 **Classical Academic Design**: Clean, professional styling with serif fonts and academic paper aesthetics
- 📝 **Markdown Blog Posts**: Write posts in markdown with automatic HTML conversion
- 🔄 **Auto-Sync**: Blog posts automatically sync when you add/modify files in the `/blogs` directory
- 📚 **Series Support**: Organize related posts into series
- 🏷️ **Tagging System**: Categorize posts with tags
- 🔍 **MathJax Integration**: Full LaTeX math rendering support
- 📱 **Responsive Design**: Works beautifully on all devices

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

3. **Visit your blog:**
   Open `http://localhost:3000` in your browser

4. **Create your first blog post:**
   Create a file `blogs/my-first-post.md`:
   ```markdown
   ---
   title: "My First Academic Post"
   date: "2024-01-01"
   series: "Getting Started"
   tags: ["introduction", "academia"]
   excerpt: "Welcome to my new academic blog!"
   ---

   # Hello Academic World

   This is my first blog post with **math support**: $E = mc^2$

   ## A Beautiful Equation

   $$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$
   ```

## Project Structure

```
academic-blog/
├── server.js              # Main server file
├── package.json           # Dependencies
├── blogs/                 # Your markdown blog posts go here
│   └── *.md              # Markdown files with frontmatter
├── views/                 # EJS templates
│   ├── layout.ejs        # Base layout
│   ├── index.ejs         # Homepage
│   ├── about.ejs         # About page
│   ├── blog.ejs          # Blog listing
│   ├── post.ejs          # Individual post
│   ├── series.ejs        # Series view
│   └── 404.ejs           # Error page
└── public/
    └── css/
        └── style.css     # Academic styling
```

## Blog Post Format

Blog posts use YAML frontmatter for metadata:

```markdown
---
title: "Your Post Title"
date: "2024-01-01"          # ISO date format
series: "Series Name"       # Optional: groups related posts
tags: ["tag1", "tag2"]      # Optional: categorization
excerpt: "Brief summary"    # Optional: shown in post listings
---

# Your Post Content

Write your content here with full **Markdown** and LaTeX support!

Math inline: $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$

Math blocks:
$$
\nabla \times \vec{F} = \left( \frac{\partial F_z}{\partial y} - \frac{\partial F_y}{\partial z} \right) \hat{i}
$$
```

## Customization

### Editing Content

- **Homepage**: Edit the research overview and personal information in `views/index.ejs`
- **About Page**: Customize your academic background in `views/about.ejs`
- **Site Title**: Change "Life & Mathematics" to your preferred title in `views/layout.ejs`

### Styling

- **Colors**: Modify CSS variables in `public/css/style.css`:
  ```css
  :root {
    --primary-color: #2c3e50;     /* Main headings */
    --secondary-color: #34495e;   /* Secondary elements */
    --accent-color: #3498db;      /* Links and highlights */
  }
  ```

- **Fonts**: The blog uses Crimson Text and Libre Baskerville for academic appearance

### Adding Pages

1. Create a new EJS template in `views/`
2. Add a route in `server.js`:
   ```javascript
   app.get('/your-page', (req, res) => {
     res.render('your-template', { title: 'Your Page' });
   });
   ```

## Mathematical Content

The blog includes MathJax for rendering mathematical expressions:

- **Inline math**: `$x^2 + y^2 = z^2$`
- **Display math**: `$$\int_0^\infty e^{-x} dx = 1$$`
- **Equation numbering**: Supported through MathJax configuration

## Development

- **Auto-restart**: Use `npm run dev` for development with nodemon
- **File watching**: The server automatically detects changes to markdown files
- **Logging**: Server logs show when posts are loaded, changed, or removed

## Production Deployment

1. Set environment variable: `NODE_ENV=production`
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "academic-blog"
   ```

## Dependencies

- **Express**: Web framework
- **EJS**: Templating engine
- **Marked**: Markdown parser
- **Gray-matter**: Frontmatter parser
- **Chokidar**: File watching
- **EJS-locals**: Layout support

## Contributing

Feel free to customize this blog for your academic needs. The codebase is designed to be clean, readable, and easily extensible.

## License

MIT License - feel free to use and modify for your academic blog needs.