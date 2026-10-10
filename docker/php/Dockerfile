FROM php:8.5.11-cli-bookworm

COPY --from=composer:2.10.3 /usr/bin/composer /usr/local/bin/composer

RUN apt-get update \
    && apt-get install -y --no-install-recommends libzip-dev unzip \
    && docker-php-ext-install bcmath zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY docker/php/entrypoint.sh /usr/local/bin/lottery-stats-entrypoint
RUN chmod +x /usr/local/bin/lottery-stats-entrypoint

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/lottery-stats-entrypoint"]
