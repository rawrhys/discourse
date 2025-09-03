/**
 * Username Service
 * Handles username collection and validation for public course users
 */

class UsernameService {
  constructor() {
    this.usernames = new Map(); // Store usernames by session ID
    this.blockedUsernames = new Set([
      // NSFW and inappropriate usernames
      'admin', 'administrator', 'moderator', 'owner', 'root',
      'fuck', 'shit', 'bitch', 'asshole', 'damn', 'hell',
      'porn', 'sex', 'nude', 'naked', 'fuckyou', 'fuckoff',
      'kill', 'die', 'death', 'murder', 'suicide', 'hate',
      'nazi', 'hitler', 'racist', 'slave', 'rape', 'abuse',
      'drug', 'cocaine', 'heroin', 'marijuana', 'weed',
      'scam', 'fraud', 'steal', 'hack', 'virus', 'malware',
      // Common inappropriate terms
      'stupid', 'idiot', 'moron', 'retard', 'gay', 'fag',
      'whore', 'slut', 'bitch', 'cunt', 'dick', 'pussy',
      // Spam and bot-like names
      'bot', 'spam', 'test', 'user', 'guest', 'anonymous',
      'null', 'undefined', 'empty', 'blank'
    ]);
  }

  /**
   * Validate username for appropriateness
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required' };
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check length
    if (cleanUsername.length < 2) {
      return { valid: false, error: 'Username must be at least 2 characters long' };
    }

    if (cleanUsername.length > 20) {
      return { valid: false, error: 'Username must be 20 characters or less' };
    }

    // Check for blocked words
    for (const blockedWord of this.blockedUsernames) {
      if (cleanUsername.includes(blockedWord)) {
        return { valid: false, error: 'Username contains inappropriate content' };
      }
    }

    // Check for special characters (only allow letters, numbers, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }

    // Check if it starts with a number
    if (/^[0-9]/.test(cleanUsername)) {
      return { valid: false, error: 'Username must start with a letter' };
    }

    return { valid: true };
  }

  /**
   * Set username for a session
   */
  setUsername(sessionId, username) {
    const validation = this.validateUsername(username);
    if (!validation.valid) {
      return validation;
    }

    this.usernames.set(sessionId, username.trim());
    return { valid: true, username: username.trim() };
  }

  /**
   * Get username for a session
   */
  getUsername(sessionId) {
    return this.usernames.get(sessionId);
  }

  /**
   * Check if session has a username
   */
  hasUsername(sessionId) {
    return this.usernames.has(sessionId);
  }

  /**
   * Remove username for a session
   */
  removeUsername(sessionId) {
    return this.usernames.delete(sessionId);
  }

  /**
   * Get all usernames (for admin purposes)
   */
  getAllUsernames() {
    return Array.from(this.usernames.entries());
  }

  /**
   * Clean up expired usernames (call periodically)
   */
  cleanup() {
    // This would be called periodically to clean up old usernames
    // For now, we'll keep them in memory
    console.log(`[UsernameService] Currently tracking ${this.usernames.size} usernames`);
  }
}

// Create singleton instance
const usernameService = new UsernameService();

export default usernameService;
