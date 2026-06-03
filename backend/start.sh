#!/bin/bash
echo "Initializing container..."

# Strictly ensure only mpm_prefork is loaded to prevent "More than one MPM loaded" error
rm -f /etc/apache2/mods-enabled/mpm_*.load
rm -f /etc/apache2/mods-enabled/mpm_*.conf
a2enmod mpm_prefork

# Configure Apache to listen on the dynamic PORT assigned by Railway
if [ -n "$PORT" ]; then
    echo "Configuring Apache to listen on PORT $PORT"
    sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
    sed -i "s/:80/:${PORT}/g" /etc/apache2/sites-available/000-default.conf
else
    echo "PORT environment variable not set, defaulting to 80"
fi

# Execute the default Apache foreground script
echo "Starting Apache..."
exec apache2-foreground
