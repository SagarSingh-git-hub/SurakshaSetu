FROM php:8.2-apache

# Enable Apache mod_rewrite for nice URLs and CORS
RUN a2enmod rewrite

# Install MySQL and cURL extensions (cURL is needed for Pusher)
RUN apt-get update && apt-get install -y libcurl4-openssl-dev
RUN docker-php-ext-install mysqli pdo pdo_mysql curl

# Change Apache document root to the working directory
ENV APACHE_DOCUMENT_ROOT /var/www/html
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Copy everything into the container
COPY . /var/www/html/

# Create uploads directory and give it write permissions so users can upload photos
RUN mkdir -p /var/www/html/backend/uploads && chmod 777 /var/www/html/backend/uploads

EXPOSE 80