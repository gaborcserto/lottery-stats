<?php

namespace Tests\Feature;

use Database\Seeders\GameSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertSame('array', config('cache.limiter'));
        Http::preventStrayRequests();
        $this->seed(GameSeeder::class);
    }

    public function test_public_access_and_default_quota_are_shared_across_routes(): void
    {
        $this->assertSame(60, config('api.requests_per_minute'));
        for ($request = 0; $request < 60; $request++) {
            $this->get('/api/v1/games')->assertOk()
                ->assertHeader('X-RateLimit-Limit', '60')
                ->assertHeader('X-RateLimit-Remaining', (string) (59 - $request));
        }
        $this->get('/api/v1/games/five/statistics/summary')->assertStatus(429)
            ->assertHeader('Content-Type', 'application/json')->assertJsonStructure(['message']);
        // Documentation and health checks do not consume the API quota.
        $this->get('/api-docs')->assertOk();
        $this->get('/up')->assertOk();
    }

    public function test_retry_after_tracks_window_expiry_and_clients_are_independent(): void
    {
        config(['api.requests_per_minute' => 1]);
        $this->freezeTime();
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.1'])->get('/api/v1/games')->assertOk();
        $this->travel(15)->seconds();
        $this->get('/api/v1/games')->assertStatus(429)->assertHeader('Retry-After', '45')
            ->assertHeader('X-RateLimit-Remaining', '0')
            ->assertHeader('X-RateLimit-Reset', (string) (now()->timestamp + 45));
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.2'])->get('/api/v1/games')->assertOk();
        $this->travel(46)->seconds();
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.1'])->get('/api/v1/games')->assertOk();
    }

    public function test_forwarded_ips_cannot_bypass_quota_unless_the_peer_is_explicitly_trusted(): void
    {
        config(['api.requests_per_minute' => 1]);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])
            ->withHeader('X-Forwarded-For', '198.51.100.1')->get('/api/v1/games')->assertOk();
        $this->withHeader('X-Forwarded-For', '198.51.100.2')->get('/api/v1/games')->assertStatus(429);

        config(['trustedproxy.proxies' => ['192.0.2.10']]);
        $this->withHeader('X-Forwarded-For', '198.51.100.1')->get('/api/v1/games')->assertOk();
        $this->withHeader('X-Forwarded-For', '198.51.100.2')->get('/api/v1/games')->assertOk();
        $this->withHeader('X-Forwarded-For', '198.51.100.1')->get('/api/v1/games')->assertStatus(429);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.11'])
            ->withHeader('X-Forwarded-For', '198.51.100.1')->get('/api/v1/games')->assertOk();
    }

    public function test_cors_is_an_explicit_allowlist_without_credentials(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173')->get('/api/v1/games')->assertOk()
            ->assertHeaderMissing('Access-Control-Allow-Origin');
        config(['cors.allowed_origins' => ['http://localhost:5173']]);
        $this->get('/api/v1/games')->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
        $this->get('/api/v1/games/five/drawings?week=54')->assertUnprocessable()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->withHeader('Origin', 'https://untrusted.example')->get('/api/v1/games')->assertOk()
            // With one configured origin, the CORS library emits that fixed origin.
            // Browsers reject it because it does not match the requesting origin.
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        config(['cors.allowed_origins' => ['http://localhost:5173', 'https://frontend.example']]);
        $this->get('/api/v1/games')->assertOk()->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_preflight_uses_framework_cors_and_does_not_consume_quota(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173'], 'api.requests_per_minute' => 1]);
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'GET',
            'Access-Control-Request-Headers' => 'Content-Type',
        ])->options('/api/v1/games')->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
            ->assertHeader('Access-Control-Allow-Headers', 'Accept, Content-Type')
            ->assertHeaderMissing('Access-Control-Allow-Credentials')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->withHeader('Origin', 'https://untrusted.example')->options('/api/v1/games')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->get('/api/v1/games')->assertOk()->assertHeader('X-RateLimit-Remaining', '0');
    }

    public function test_json_errors_and_security_headers_cover_success_and_errors(): void
    {
        config(['api.requests_per_minute' => 2, 'app.debug' => false]);
        foreach ([
            ['/api/v1/games', 200],
            ['/api/v1/games/five/drawings?week=54', 422],
            ['/api/v1/games', 429],
            ['/api/v1/not-a-route', 404],
        ] as [$url, $status]) {
            $response = $this->get($url)->assertStatus($status)
                ->assertHeader('Content-Type', 'application/json')
                ->assertHeader('X-Content-Type-Options', 'nosniff')
                ->assertHeader('Referrer-Policy', 'no-referrer')
                ->assertHeader('Cache-Control', 'no-store, private')
                ->assertHeaderMissing('Strict-Transport-Security')
                ->assertHeaderMissing('Content-Security-Policy');
            if ($status !== 200) {
                $response->assertJsonStructure(['message']);
            }
        }
    }

    public function test_production_500_hides_internal_diagnostics_and_development_keeps_them(): void
    {
        Route::middleware('api')->get('/api/v1/test-failure', function (): never {
            throw new \RuntimeException('private database path and SQL');
        });
        config(['app.debug' => false, 'cors.allowed_origins' => ['http://localhost:5173']]);
        $this->withHeader('Origin', 'http://localhost:5173')->get('/api/v1/test-failure')
            ->assertStatus(500)->assertExactJson(['message' => 'Server Error'])
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'no-referrer')->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        config(['app.debug' => true]);
        $this->get('/api/v1/test-failure')->assertStatus(500)
            ->assertJsonPath('message', 'private database path and SQL')->assertJsonStructure(['trace']);
    }

    public function test_production_404_does_not_expose_eloquent_model_names(): void
    {
        config(['app.debug' => false]);
        $this->get('/api/v1/games/five/drawings/999999')->assertNotFound()
            ->assertExactJson(['message' => 'Not Found']);
        $this->get('/api/v1/games/five/drawings/latest')->assertNotFound()
            ->assertExactJson(['message' => 'Not Found']);
        $this->get('/api/v1/games/unknown')->assertNotFound()
            ->assertExactJson(['message' => 'Not Found']);
    }

    public function test_route_surface_is_read_only_and_does_not_expose_server_commands(): void
    {
        foreach (Route::getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'api/')) {
                $this->assertSame(['GET', 'HEAD'], $route->methods());
                $this->assertStringStartsWith('api/v1/games', $route->uri());
            }
        }
        foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            $this->call($method, '/api/v1/games')->assertStatus(405)
                ->assertHeader('Content-Type', 'application/json');
        }
        foreach (['import', 'sync', 'migrate', 'admin'] as $path) {
            $this->post('/api/v1/'.$path)->assertNotFound();
        }
    }
}
