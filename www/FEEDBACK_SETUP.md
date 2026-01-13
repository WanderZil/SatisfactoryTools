# Feedback Feature Setup

The feedback feature uses SendGrid to send emails. To enable it, you need to:

## 1. Install SendGrid Python Library

```bash
pip install sendgrid
```

## 2. Get SendGrid API Key

1. Sign up for a free SendGrid account at https://sendgrid.com
2. Go to Settings > API Keys
3. Create a new API key with "Mail Send" permissions
4. Copy the API key

## 3. Set Environment Variables

Before starting the server, set these environment variables:

```bash
export SENDGRID_API_KEY="your-sendgrid-api-key-here"
export FEEDBACK_RECIPIENT_EMAIL="your-email@example.com"
```

Or on Windows:

```cmd
set SENDGRID_API_KEY=your-sendgrid-api-key-here
set FEEDBACK_RECIPIENT_EMAIL=your-email@example.com
```

## 4. Start the Server

```bash
cd www
python3 server.py
```

## Notes

- The feedback form will send emails from the user's email address to your recipient email
- SendGrid free tier allows 100 emails per day
- Make sure to verify your sender email in SendGrid dashboard if required

