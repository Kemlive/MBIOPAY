// src/routes/auth.ts

// Add the missing functions and constants 

const VERIFY_CODE_TTL_MS = 300000; // 5 minutes

function generateVerifyCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit verification code
}

async function sendVerificationEmail(email) {
    try {
        const verifyCode = generateVerifyCode();
        // Logic to send email goes here...
        console.log(`Verification email sent to ${email} with code: ${verifyCode}`);
    } catch (error) {
        console.error('Error sending verification email:', error.message);
        throw new Error('Failed to send verification email. Please try again later.');
    }
}