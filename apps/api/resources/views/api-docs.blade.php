<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lottery Stats API</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api-docs/openapi.json',
            dom_id: '#swagger-ui',
            supportedSubmitMethods: ['get'],
            validatorUrl: null,
            withCredentials: false
        });
    </script>
</body>
</html>
