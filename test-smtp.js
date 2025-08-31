// Test SMTP configuration and email sending
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

console.log('🔧 Testing SMTP Configuration...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
console.log('SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
console.log('SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'SET' : 'NOT SET');
console.log('SMTP_FROM:', process.env.SMTP_FROM || 'NOT SET');
console.log('');

// Create transporter
const createTransporter = () => {
  console.log('📧 Creating SMTP transporter...');
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Missing required SMTP configuration');
    return null;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    console.log('✅ Transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create transporter:', error);
    return null;
  }
};

// Test email sending
const testEmail = async () => {
  const transporter = createTransporter();
  if (!transporter) {
    return;
  }
  
  console.log('\n📤 Testing email sending...');
  
  try {
    // Verify SMTP connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    
    // Send test email
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@thediscourse.ai',
      to: 'test@example.com', // Change this to your email for testing
      subject: 'SMTP Test - Discourse AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">SMTP Test Successful! 🎉</h2>
          <p>This is a test email to verify your SMTP configuration is working correctly.</p>
          <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
          <p><strong>SMTP Port:</strong> ${process.env.SMTP_PORT || 587}</p>
          <p><strong>SMTP User:</strong> ${process.env.SMTP_USER}</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        </div>
      `
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
  }
};

// Test verification email function
const testVerificationEmail = async () => {
  const transporter = createTransporter();
  if (!transporter) {
    return;
  }
  
  console.log('\n🔐 Testing verification email function...');
  
  try {
    const verificationToken = 'test_token_' + Date.now();
    const email = 'test@example.com'; // Change this to your email for testing
    const name = 'Test User';
    
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://thediscourse.ai'}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email - Discourse AI</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      </div>
    `;
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@thediscourse.ai',
      to: email,
      subject: 'Verify Your Email - Discourse AI',
      html: htmlContent
    });
    
    console.log('✅ Verification email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Verification URL:', verificationUrl);
    
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting SMTP tests...\n');
  
  await testEmail();
  await testVerificationEmail();
  
  console.log('\n✨ SMTP testing completed!');
};

runTests().catch(console.error);
