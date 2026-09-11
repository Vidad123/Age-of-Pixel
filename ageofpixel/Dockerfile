FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers \
    && sed -ri \
      -e 's!/var/www/html!/var/www/html/public!g' \
      /etc/apache2/sites-available/*.conf \
      /etc/apache2/apache2.conf \
      /etc/apache2/conf-available/*.conf

COPY --chown=www-data:www-data . /var/www/html

EXPOSE 80
