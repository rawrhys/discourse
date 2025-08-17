# Assets Directory

## Discourse Logo

The application uses a fallback system for the discourse logo:

1. **Primary**: `discourse-logo.svg` - Vector logo (currently provided)
2. **Fallback**: `discourse-logo.png` - Raster logo (should be placed here)

**Important Notes:**
- Use URL-safe filenames (no spaces, use hyphens instead)
- Both files are included in .gitignore to preserve them on the server
- The SVG logo is currently provided as a fallback
- Replace the PNG file with the actual discourse logo when available

## File Location

The logo files should be placed at:
```
public_html/assets/images/
├── discourse-logo.svg
└── discourse-logo.png
```

## Usage

The discourse logo is used in:
- `src/components/auth/Login.jsx`
- `src/components/auth/Register.jsx`

Both components reference the logo at: `/public_html/assets/images/discourse-logo.svg` with PNG fallback

## File Naming Convention

- Use URL-safe filenames (no spaces, use hyphens instead)
- This prevents 404 errors due to URL encoding issues
- The original filename `discourse logo.png` caused 404 errors
- SVG is preferred for scalability and smaller file size
