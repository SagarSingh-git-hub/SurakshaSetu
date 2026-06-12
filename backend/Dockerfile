FROM php:8.2-apache

# Enable Apache mod_rewrite for nice URLs and CORS
RUN a2enmod rewrite

# Install MySQL, cURL, unzip, git extensions
RUN apt-get update && apt-get install -y libcurl4-openssl-dev unzip git
RUN docker-php-ext-install mysqli pdo pdo_mysql curl

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Change Apache document root to the working directory
ENV APACHE_DOCUMENT_ROOT=/var/www/html/backend
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
RUN sed -i '/<Directory ${APACHE_DOCUMENT_ROOT}>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf || true
RUN echo "<Directory ${APACHE_DOCUMENT_ROOT}>\n\tAllowOverride All\n</Directory>" >> /etc/apache2/apache2.conf

# Disable conflicting MPMs and strictly enable prefork (fixes "More than one MPM loaded" error)
RUN a2dismod mpm_event mpm_worker || true
RUN a2enmod mpm_prefork

# Configure Apache to listen on the port provided by Render
RUN sed -i 's/80/${PORT}/g' /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf

# Copy everything into the backend directory
COPY . /var/www/html/backend/

# Run Composer Install
RUN cd /var/www/html/backend && composer install --no-dev --optimize-autoloader

# Create uploads directory and give it write permissions so users can upload photos
RUN mkdir -p /var/www/html/backend/uploads && chmod 777 /var/www/html/backend/uploads

EXPOSE 80