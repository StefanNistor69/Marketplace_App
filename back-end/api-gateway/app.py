from flask import Flask, request, jsonify
import requests
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# Set up rate limiting (15 requests per minute for user-file service)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["15 per minute"]
)

# Define the single instance of the user-file service
USER_FILE_SERVICE = 'http://localhost:5001' 
NOTIFICATION_SERVICE = 'http://localhost:5002'  # Instance of the notification microservice

# Timeout setting for requests
TIMEOUT = 10  # 10 seconds timeout for all requests


# Function to proxy requests to the user-file service
@app.route('/user/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
@limiter.limit("15 per minute")
def proxy_user_file_service(path):
    service_url = f"{USER_FILE_SERVICE}/user/{path}"
    
    # Prepare the notification URL based on the user action
    if path == 'signup':
        notification_url = f"{NOTIFICATION_SERVICE}/notify-signup"
    elif path == 'login':
        notification_url = f"{NOTIFICATION_SERVICE}/notify-login"
    else:
        notification_url = None

    try:
        # Forward the request based on its HTTP method
        if request.method == 'GET':
            response = requests.get(service_url, timeout=TIMEOUT)
        elif request.method == 'POST':
            response = requests.post(service_url, json=request.json, timeout=TIMEOUT)
        elif request.method == 'PUT':
            response = requests.put(service_url, json=request.json, timeout=TIMEOUT)
        elif request.method == 'DELETE':
            response = requests.delete(service_url, timeout=TIMEOUT)
        
        print("Request Accepted", flush=True)

        # If the user action is login or signup and was successful, notify the notification service
        if response.status_code in [200, 201] and notification_url:
            print(f"Notifying notification service for {path}...", flush=True)
            notify_response = requests.post(notification_url, timeout=TIMEOUT)
            
            if notify_response.status_code == 200:
                print(f"{path.capitalize()} notification sent successfully", flush=True)
            else:
                print(f"Failed to send {path} notification", flush=True)
        
        # Return the response from the user-file service
        return (response.content, response.status_code, response.headers.items())

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out"}), 504

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
    

@app.route('/beats/upload', methods=['POST'])
@limiter.limit("15 per minute")
def proxy_beat_upload():
    service_url = f"{USER_FILE_SERVICE}/beats/upload"
    notification_url = f"{NOTIFICATION_SERVICE}/notify-upload"
    
    print(f"Forwarding file upload request to: {service_url}", flush=True)
    try:
        if 'beat' in request.files:
            # Forward the file and form data to the user-file service
            files = {'beat': request.files['beat']}
            data = {
                'title': request.form.get('title'),
                'artist': request.form.get('artist')
            }

            # Forward the JWT token to the user-file service
            headers = {'Authorization': request.headers.get('Authorization')}
            
            response = requests.post(service_url, files=files, data=data, headers=headers, timeout=TIMEOUT)

            if response.status_code == 201:
                # Notify the notification service with a simple request
                print("Notifying notification service...", flush=True)
                
                notify_response = requests.post(notification_url, timeout=TIMEOUT)

                if notify_response.status_code == 200:
                    print("Notification sent successfully", flush=True)
                else:
                    print("Failed to send notification", flush=True)

            return (response.content, response.status_code, response.headers.items())
        else:
            return jsonify({"error": "No file part in the request"}), 400

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out"}), 504

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500


# @app.route('/notify-upload', methods=['POST'])
# def proxy_notify_upload():
#     service_url = f"{NOTIFICATION_SERVICE}/notify-upload"
#     try:
#         # Send a simple notification request to the notification service
#         response = requests.post(service_url, timeout=TIMEOUT)
#         return (response.content, response.status_code, response.headers.items())
#     except requests.exceptions.Timeout:
#         return jsonify({"error": "Request timed out"}), 504
#     except requests.exceptions.RequestException as e:
#         return jsonify({"error": str(e)}), 500
    
# # Error handler for rate limits
# @app.errorhandler(429)
# def ratelimit_handler(e):
#     return jsonify(error="rate limit exceeded"), 429


# Start the Flask API Gateway
if __name__ == "__main__":
    app.run(port=3000, debug=True)
