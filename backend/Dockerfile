FROM php:8.2-apache

# Enable Apache mod_rewrite for nice URLs and CORS
RUN a2enmod rewrite

# Install MySQL and cURL extensions (cURL is needed for Pusher)
RUN apt-get update && apt-get install -y libcurl4-openssl-dev
RUN docker-php-ext-install mysqli pdo pdo_mysql curl

# Change Apache document root to the working directory
ENV APACHE_DOCUMENT_ROOT=/var/www/html/backend
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Disable conflicting MPMs and strictly enable prefork (fixes "More than one MPM loaded" error)
RUN a2dismod mpm_event mpm_worker || true
RUN a2enmod mpm_prefork

# Copy everything into the backend directory
COPY . /var/www/html/backend/

# Create uploads directory and give it write permissions so users can upload photos
RUN mkdir -p /var/www/html/backend/uploads && chmod 777 /var/www/html/backend/uploads

# Configure Apache to use the dynamic PORT assigned by Railway at runtime
CMD sed -i "s/Listen 80/Listen ${PORT:-80}/g" /etc/apache2/ports.conf && \
    sed -i "s/:80/:${PORT:-80}/g" /etc/apache2/sites-available/000-default.conf && \
    apache2-foreground