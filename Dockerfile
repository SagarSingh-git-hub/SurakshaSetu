FROM php:8.2-apache

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Install MySQL extension
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Set the document root to the app directory
ENV APACHE_DOCUMENT_ROOT /var/www/html
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Copy application files
COPY . /var/www/html/

# Create uploads directory and set permissions
RUN mkdir -p /var/www/html/backend/uploads && chmod 777 /var/www/html/backend/uploads

# Expose port 80 (Railway will map this automatically)
EXPOSE 80
