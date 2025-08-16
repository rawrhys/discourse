const jwt = require('jsonwebtoken');

// JWT secret from your ecosystem.config.cjs
const JWT_SECRET = "3VZ4eeAbeY/q9n4tKT2p15DHoEaUtcjke0YmIXdWCzvimV3S66N+w0zlPHdOQfLRzh7+wce2kBR3vv+KE9vhDw==";

// Create a test payload
const payload = {
  userId: "test-user-123",
  email: "test@example.com",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours from now
};

// Generate the token
const token = jwt.sign(payload, JWT_SECRET);

console.log("Generated JWT Token:");
console.log(token);
console.log("\nUse this token in your API calls:");
console.log(`Authorization: Bearer ${token}`);
