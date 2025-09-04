# Email Templates

This directory contains HTML email templates for Discourse AI.

## Available Templates

### 1. Signup Confirmation (`signup-confirmation.html`)
- **Purpose**: Sent when a user signs up to confirm their email address
- **Template Variables**:
  - `{{ .Email }}` - User's email address
  - `{{ .ConfirmationURL }}` - URL to confirm email
  - `{{ .CurrentYear }}` - Current year for copyright

### 2. Password Reset (`password-reset.html`)
- **Purpose**: Sent when a user requests a password reset
- **Template Variables**:
  - `{{ .Email }}` - User's email address
  - `{{ .ResetURL }}` - URL to reset password
  - `{{ .CurrentYear }}` - Current year for copyright

## Template Features

- **Responsive Design**: Mobile-friendly layout
- **Dark Mode Support**: Compatible with dark mode email clients
- **Accessibility**: Proper alt text and semantic HTML
- **Cross-Client Compatibility**: Tested across major email clients
- **Professional Branding**: Consistent with Discourse AI visual identity

## Usage

These templates use Go template syntax and can be rendered with any Go template engine. The templates are designed to be:

1. **Read from file** and stored as strings in your application
2. **Rendered with data** using Go's `html/template` package
3. **Sent via SMTP** or email service

## Example Go Usage

```go
import (
    "html/template"
    "bytes"
)

func renderEmailTemplate(templatePath string, data interface{}) (string, error) {
    tmpl, err := template.ParseFiles(templatePath)
    if err != nil {
        return "", err
    }
    
    var buf bytes.Buffer
    err = tmpl.Execute(&buf, data)
    if err != nil {
        return "", err
    }
    
    return buf.String(), nil
}

// Usage
data := struct {
    Email string
    ConfirmationURL string
    CurrentYear int
}{
    Email: "user@example.com",
    ConfirmationURL: "https://thediscourse.ai/confirm?token=abc123",
    CurrentYear: 2024,
}

htmlContent, err := renderEmailTemplate("email-templates/signup-confirmation.html", data)
```

## Customization

- **Logo**: Update the logo URL in the header section
- **Colors**: Modify the CSS variables for brand consistency
- **Contact Info**: Update the admin email address in the footer
- **Branding**: Adjust text and styling to match your brand guidelines

## Security Notes

- Password reset links should expire (recommended: 1 hour)
- Always use HTTPS for confirmation/reset URLs
- Implement rate limiting for password reset requests
- Log password reset attempts for security monitoring
