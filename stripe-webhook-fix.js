// Corrected Stripe webhook logic for user creation and email verification
// Replace the existing webhook section in server.js with this code

// Handle registration subscription (new users)
if (session.metadata?.registrationEmail) {
  const registrationEmail = session.metadata.registrationEmail;
  const registrationPassword = session.metadata.registrationPassword;
  
  console.log(`[Stripe] Registration subscription started for email: ${registrationEmail}`);
  
  // Create the user account immediately after successful payment
  try {
    // Check if user already exists
    let existingUser = db.data.users.find(u => u.email === registrationEmail);
    if (existingUser) {
      console.log(`[Stripe] User already exists: ${registrationEmail}`);
      // Update existing user with subscription info
      existingUser.stripeSubscriptionId = session.subscription;
      existingUser.subscriptionStatus = 'active';
      existingUser.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days from now
      existingUser.updatedAt = new Date().toISOString();
      await db.write();
    } else {
      // Create new user account with proper verification token
      const verificationToken = generateVerificationToken();
      const newUser = {
        id: generateId(),
        email: registrationEmail.toLowerCase(),
        password: registrationPassword, // Note: In production, this should be hashed
        name: registrationEmail.split('@')[0], // Use email prefix as name
        createdAt: new Date().toISOString(),
        emailVerified: false,
        verificationToken: verificationToken,
        verificationTokenCreatedAt: new Date().toISOString(),
        stripeSubscriptionId: session.subscription,
        subscriptionStatus: 'active',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        courseCredits: 10, // Give initial credits
        gdprConsent: true,
        policyVersion: '1.0',
        source: 'stripe_registration'
      };
      
      db.data.users.push(newUser);
      console.log(`[Stripe] Created new user account: ${registrationEmail} with ID: ${newUser.id}`);
      
      // Save to database first
      await db.write();
      console.log(`[Stripe] User saved to database: ${registrationEmail}`);
      
      // Send email verification email
      try {
        console.log(`[Stripe] Attempting to send verification email to: ${registrationEmail}`);
        console.log(`[Stripe] SMTP Configuration:`, {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER ? 'SET' : 'NOT SET',
          pass: process.env.SMTP_PASS ? 'SET' : 'NOT SET'
        });
        
        await sendVerificationEmail(registrationEmail, verificationToken, newUser.name);
        console.log(`[Stripe] Email verification sent successfully to: ${registrationEmail}`);
        
        // Update user record to confirm email was sent
        newUser.verificationEmailSent = true;
        newUser.verificationEmailSentAt = new Date().toISOString();
        await db.write();
        
      } catch (emailError) {
        console.error('[Stripe] Failed to send email verification:', emailError);
        console.error('[Stripe] Email error details:', {
          message: emailError.message,
          stack: emailError.stack
        });
        
        // Mark that email failed but don't fail the user creation
        newUser.verificationEmailSent = false;
        newUser.verificationEmailError = emailError.message;
        await db.write();
      }
    }
    
    console.log(`[Stripe] User account setup completed for: ${registrationEmail}`);
    
  } catch (err) {
    console.error('[Stripe] Error creating user account:', err);
    console.error('[Stripe] Error details:', {
      message: err.message,
      stack: err.stack
    });
  }
} else {
  console.log(`[Stripe] Webhook: No registrationEmail found in metadata:`, session.metadata);
}
