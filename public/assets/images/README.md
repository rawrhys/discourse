# Assets Directory

## Discourse Logo

The file `discourse logo.png` should be placed in this directory.

**Important Notes:**
- The filename must be exactly: `discourse logo.png` (with space)
- This file is referenced in the Login and Register components
- The file is included in .gitignore to preserve it on the server
- If the file is missing, the login/register pages will show a broken image

## Usage

The discourse logo is used in:
- `src/components/auth/Login.jsx`
- `src/components/auth/Register.jsx`

Both components reference the logo at: `/assets/images/discourse logo.png`
