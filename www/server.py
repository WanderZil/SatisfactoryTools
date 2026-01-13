#!/usr/bin/env python3
import http.server
import socketserver
import urllib.parse
import os
import gzip
import io
import json
import sys

# Try to import sendgrid, but don't fail if it's not installed
try:
	import sendgrid
	from sendgrid.helpers.mail import Mail, Email, Content
	SENDGRID_AVAILABLE = True
except ImportError:
	SENDGRID_AVAILABLE = False
	print("Warning: sendgrid library not installed. Feedback feature will not work.")
	print("Install it with: pip install sendgrid")

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        """
        Dev server cache headers.

        IMPORTANT:
        - `Cache-Control: no-store` disables bfcache. Lighthouse will report:
          "Page prevented back/forward cache restore".
        - We keep HTML revalidation for fast iteration, while allowing bfcache.
        - We allow long caching for static assets to better match production behavior.
        """
        path = urllib.parse.urlparse(self.path).path
        _, ext = os.path.splitext(path.lower())
        filename = os.path.basename(path.lower())

        # HTML: allow bfcache + always revalidate
        if ext in ('', '.html'):
            self.send_header('Cache-Control', 'no-cache')
        # app.js is not hashed, so it MUST NOT be cached as immutable; otherwise changes won't show up.
        elif filename == 'app.js':
            self.send_header('Cache-Control', 'no-cache')
        # Static assets: cache aggressively (safe for hashed bundles; acceptable for local dev too)
        elif ext in ('.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map', '.json'):
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            # Default: do not block bfcache
            self.send_header('Cache-Control', 'no-cache')

        return super().end_headers()
    
    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path

        # Many browsers still request /favicon.ico even if <link rel="icon"> is set.
        # Serve the generated favicon from our icons directory to avoid missing tab icon.
        if path == '/favicon.ico':
            self.path = '/assets/images/icons/favicon.ico'
            return super().do_GET()

        # Serve existing static files (optionally gzip-compressed) for faster local Lighthouse runs.
        # This reduces "network payload too large" warnings without changing the JS build output.
        fs_path = '.' + path
        if os.path.exists(fs_path) and not os.path.isdir(fs_path):
            _, ext = os.path.splitext(path.lower())
            compressible = ext in (
                '.js', '.css', '.json', '.svg', '.txt', '.map',
                '.woff2', '.woff', '.ttf', '.eot',
            )

            accept_encoding = self.headers.get('Accept-Encoding', '')
            if compressible and 'gzip' in accept_encoding:
                try:
                    with open(fs_path, 'rb') as f:
                        raw = f.read()

                    buf = io.BytesIO()
                    with gzip.GzipFile(fileobj=buf, mode='wb') as gz:
                        gz.write(raw)
                    gzipped = buf.getvalue()

                    self.send_response(200)
                    self.send_header('Content-Type', self.guess_type(fs_path))
                    self.send_header('Content-Encoding', 'gzip')
                    self.send_header('Vary', 'Accept-Encoding')
                    self.send_header('Content-Length', str(len(gzipped)))
                    self.end_headers()
                    self.wfile.write(gzipped)
                    return
                except Exception:
                    # Fallback to default handling if compression fails for any reason.
                    return super().do_GET()
        
        # If it's a file that exists, serve it
        if os.path.exists('.' + url.path) and not os.path.isdir('.' + url.path):
            return super().do_GET()
        
        # Otherwise, serve index.html for SPA routing
        self.path = '/index.html'
        return super().do_GET()

    def do_HEAD(self):
        """Support HEAD for common assets like /favicon.ico (some clients probe with HEAD)."""
        url = urllib.parse.urlparse(self.path)
        path = url.path
        if path == '/favicon.ico':
            self.path = '/assets/images/icons/favicon.ico'
        return super().do_HEAD()

    def do_POST(self):
        """Handle POST requests for API endpoints."""
        url = urllib.parse.urlparse(self.path)
        path = url.path

        if path == '/api/feedback':
            self.handle_feedback()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def handle_feedback(self):
        """Handle feedback form submission and send email via SendGrid."""
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            # Validate required fields
            required_fields = ['name', 'email', 'subject', 'message']
            for field in required_fields:
                if field not in data or not data[field]:
                    self.send_error_response(400, f'Missing required field: {field}')
                    return

            # Get SendGrid API key from environment variable
            sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
            recipient_email = os.environ.get('FEEDBACK_RECIPIENT_EMAIL', 'your-email@example.com')

            if not SENDGRID_AVAILABLE:
                self.send_error_response(503, 'SendGrid library not available. Please install it.')
                return

            if not sendgrid_api_key:
                self.send_error_response(503, 'SENDGRID_API_KEY environment variable not set.')
                return

            # Create SendGrid mail
            sg = sendgrid.SendGridAPIClient(api_key=sendgrid_api_key)
            
            # Email content
            email_content = f"""
Name: {data['name']}
Email: {data['email']}
Subject: {data['subject']}

Message:
{data['message']}
"""

            message = Mail(
                from_email=Email(data['email'], data['name']),
                to_emails=Email(recipient_email),
                subject=f'[StarRupture Tools Feedback] {data["subject"]}',
                plain_text_content=Content('text/plain', email_content)
            )

            # Send email
            response = sg.send(message)

            if response.status_code >= 200 and response.status_code < 300:
                self.send_json_response(200, {'success': True, 'message': 'Feedback sent successfully'})
            else:
                self.send_error_response(500, f'SendGrid API error: {response.status_code}')

        except json.JSONDecodeError:
            self.send_error_response(400, 'Invalid JSON in request body')
        except Exception as e:
            self.send_error_response(500, f'Internal server error: {str(e)}')

    def send_json_response(self, status_code, data):
        """Send JSON response."""
        response = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response)

    def send_error_response(self, status_code, error_message):
        """Send error JSON response."""
        self.send_json_response(status_code, {'success': False, 'error': error_message})

PORT = 8080
# Allow quick restart during local development (avoid "Address already in use")
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    print("SPA routing enabled - all routes will serve index.html")
    if SENDGRID_AVAILABLE:
        if os.environ.get('SENDGRID_API_KEY'):
            recipient = os.environ.get('FEEDBACK_RECIPIENT_EMAIL', 'your-email@example.com')
            print(f"Feedback feature: ENABLED (SendGrid configured, recipient: {recipient})")
        else:
            print("Feedback feature: DISABLED (SENDGRID_API_KEY not set)")
            print("  Set SENDGRID_API_KEY and FEEDBACK_RECIPIENT_EMAIL environment variables to enable")
    else:
        print("Feedback feature: DISABLED (sendgrid library not installed)")
        print("  Install with: pip install sendgrid")
    httpd.serve_forever()
