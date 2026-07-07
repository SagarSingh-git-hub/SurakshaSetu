FROM php:8.2-apache

# Install dependencies for PHP, Python, Nginx, and Supervisor
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev unzip git \
    python3 python3-pip python3-venv \
    nginx supervisor \
    && docker-php-ext-install mysqli pdo pdo_mysql curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Configure Apache for PHP backend
ENV APACHE_DOCUMENT_ROOT=/var/www/html/backend
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
RUN sed -i '/<Directory ${APACHE_DOCUMENT_ROOT}>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf || true
RUN echo "<Directory ${APACHE_DOCUMENT_ROOT}>\n\tAllowOverride All\n</Directory>" >> /etc/apache2/apache2.conf

# Disable conflicting MPMs and strictly enable prefork
RUN a2dismod mpm_event mpm_worker || true
RUN a2enmod mpm_prefork
RUN a2enmod rewrite

# Change Apache port to 8080 so Nginx can use the main port
RUN sed -i 's/80/8080/g' /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf

# Set up Python environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy the entire project
WORKDIR /var/www/html
COPY . /var/www/html/

# Run Composer Install for PHP backend
RUN cd /var/www/html/backend && composer install --no-dev --optimize-autoloader

# Create uploads directory and give it write permissions
RUN mkdir -p /var/www/html/backend/uploads && chmod 777 /var/www/html/backend/uploads

# Install Python requirements
RUN cd /var/www/html/backend-python && pip install --no-cache-dir -r requirements.txt

# Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

# Use entrypoint script to substitute PORT before starting supervisor
CMD ["/usr/local/bin/entrypoint.sh"]
