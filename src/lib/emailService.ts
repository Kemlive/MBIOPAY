// Import necessary modules
import nodemailer from 'nodemailer';

// Function to create transport for sending emails
export const createTransport = () => {
    // Check if SMTP_HOST is configured
    if (!process.env.SMTP_HOST) {
        throw new Error('SMTP_HOST is not configured.');
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE || false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};
