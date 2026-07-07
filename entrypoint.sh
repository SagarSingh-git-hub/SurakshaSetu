#!/bin/bash
# Render sets the $PORT environment variable. Default to 80 if not set.
PORT="${PORT:-80}"

# Update Nginx config to listen on $PORT
sed -i "s/listen 80;/listen ${PORT};/g" /etc/nginx/nginx.conf

# Start Supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
