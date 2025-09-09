// Email service for password reset and notifications
// TODO: Integrate with actual email provider (SendGrid, Mailgun, etc.)

export interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

export class EmailService {
	/**
	 * Send password reset email
	 */
	static async sendPasswordResetEmail(
		email: string, 
		resetToken: string, 
		userName: string,
		baseUrl: string
	): Promise<boolean> {
		const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
		
		const emailOptions: EmailOptions = {
			to: email,
			subject: 'Reset Your BoutiquePortal Password',
			html: this.getPasswordResetHtml(userName, resetUrl),
			text: this.getPasswordResetText(userName, resetUrl)
		};

		// TODO: Replace with actual email sending logic
		console.log('📧 Password Reset Email (Development Mode)');
		console.log('To:', email);
		console.log('Subject:', emailOptions.subject);
		console.log('Reset URL:', resetUrl);
		console.log('HTML Content:', emailOptions.html);
		
		// Simulate email sending delay
		await new Promise(resolve => setTimeout(resolve, 100));
		
		return true; // Return true for now
	}

	/**
	 * Send welcome email for new users
	 */
	static async sendWelcomeEmail(
		email: string,
		userName: string,
		loginUrl: string
	): Promise<boolean> {
		const emailOptions: EmailOptions = {
			to: email,
			subject: 'Welcome to BoutiquePortal!',
			html: this.getWelcomeEmailHtml(userName, loginUrl),
			text: this.getWelcomeEmailText(userName, loginUrl)
		};

		// TODO: Replace with actual email sending logic
		console.log('📧 Welcome Email (Development Mode)');
		console.log('To:', email);
		console.log('Subject:', emailOptions.subject);
		
		return true;
	}

	/**
	 * Password reset email HTML template
	 */
	private static getPasswordResetHtml(userName: string, resetUrl: string): string {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Reset Your Password - BoutiquePortal</title>
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { text-align: center; background: #6366f1; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
					.content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
					.button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
					.footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🔐 Password Reset Request</h1>
					</div>
					<div class="content">
						<p>Hello <strong>${userName}</strong>,</p>
						<p>We received a request to reset your BoutiquePortal password. Click the button below to create a new password:</p>
						<p style="text-align: center; margin: 30px 0;">
							<a href="${resetUrl}" class="button">Reset My Password</a>
						</p>
						<p><strong>This link will expire in 1 hour</strong> for security reasons.</p>
						<p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
						<p>For security, this link can only be used once.</p>
					</div>
					<div class="footer">
						<p>© 2025 BoutiquePortal. This email was sent from a secured system.</p>
						<p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
						<p style="word-break: break-all;">${resetUrl}</p>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	/**
	 * Password reset email plain text template
	 */
	private static getPasswordResetText(userName: string, resetUrl: string): string {
		return `
Hello ${userName},

We received a request to reset your BoutiquePortal password.

To reset your password, visit this link:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

For security, this link can only be used once.

© 2025 BoutiquePortal
		`.trim();
	}

	/**
	 * Welcome email HTML template
	 */
	private static getWelcomeEmailHtml(userName: string, loginUrl: string): string {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Welcome to BoutiquePortal!</title>
				<style>
					body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { text-align: center; background: #6366f1; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
					.content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
					.button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🎉 Welcome to BoutiquePortal!</h1>
					</div>
					<div class="content">
						<p>Hello <strong>${userName}</strong>,</p>
						<p>Welcome to BoutiquePortal! Your account has been created successfully.</p>
						<p style="text-align: center; margin: 30px 0;">
							<a href="${loginUrl}" class="button">Login to Your Account</a>
						</p>
						<p>Start managing your Instagram accounts with our powerful automation tools.</p>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	/**
	 * Welcome email plain text template
	 */
	private static getWelcomeEmailText(userName: string, loginUrl: string): string {
		return `
Hello ${userName},

Welcome to BoutiquePortal! Your account has been created successfully.

Login to your account: ${loginUrl}

Start managing your Instagram accounts with our powerful automation tools.

© 2025 BoutiquePortal
		`.trim();
	}
}

export default EmailService;