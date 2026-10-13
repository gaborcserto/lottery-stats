<?php

namespace Tests\Feature;

use App\Http\Requests\Api\V1\StatisticsRequest;
use App\Lottery\DrawingFilters;
use App\Models\Game;
use Database\Seeders\GameSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class OpenApiTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, mixed> */
    private array $spec;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        Http::preventStrayRequests();
        $this->seed(GameSeeder::class);
        $this->spec = json_decode(file_get_contents(resource_path('openapi.json')), true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_specification_covers_exactly_the_public_routes_without_authentication(): void
    {
        $this->assertSame('3.0.3', $this->spec['openapi']);
        $this->assertSame([], $this->spec['security']);
        $this->assertArrayNotHasKey('securitySchemes', $this->spec['components']);
        $paths = [];
        foreach (Route::getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'api/')) {
                $this->assertSame(['GET', 'HEAD'], $route->methods());
                $paths[] = '/'.$route->uri();
            }
        }
        $this->assertCount(10, $paths);
        $this->assertEqualsCanonicalizing($paths, array_keys($this->spec['paths']));
        foreach ($this->spec['paths'] as $uri => $path) {
            $this->assertSame(['get'], array_keys($path));
            $this->assertArrayNotHasKey('security', $path['get']);
            foreach (['404', '429', '500'] as $status) {
                $this->assertArrayHasKey($status, $path['get']['responses']);
            }
            if (str_contains($uri, '/statistics/') || str_ends_with($uri, '/drawings')) {
                $this->assertArrayHasKey('422', $path['get']['responses']);
            }
        }
        $this->assertArrayHasKey('Retry-After', $this->spec['components']['responses']['TooManyRequests']['headers']);
    }

    public function test_documented_query_parameters_and_bounds_match_validation(): void
    {
        foreach (['five', 'six', 'scandinavian'] as $game) {
            foreach ($this->spec['paths'] as $path => $item) {
                if (! str_contains($path, '/statistics/') && ! str_ends_with($path, '/drawings')) {
                    continue;
                }
                if (str_contains($path, '/statistics/')) {
                    $metric = basename($path);
                    $route = new \Illuminate\Routing\Route('GET', $path, []);
                    $route->bind(Request::create(str_replace('{game}', $game, $path)));
                    $route->setParameter('metric', $metric);
                    $request = new StatisticsRequest;
                    $request->setRouteResolver(fn () => $route);
                    $request->authorize();
                    $rules = $request->rules();
                } else {
                    $rules = ['page' => ['integer', 'min:1', 'max:1000000'], 'per_page' => ['integer', 'min:1', 'max:100'], 'include' => ['in:details'], ...DrawingFilters::rules()];
                }
                $queries = [];
                foreach ($item['get']['parameters'] as $parameter) {
                    $parameter = $this->spec['components']['parameters'][basename($parameter['$ref'])];
                    if ($parameter['in'] !== 'query') {
                        continue;
                    }
                    $name = $parameter['name'];
                    $queries[] = $name;
                    foreach ($rules[$name] as $rule) {
                        $rule = (string) $rule;
                        if (str_starts_with($rule, 'min:')) {
                            $this->assertSame((int) substr($rule, 4), $parameter['schema']['minimum']);
                        } elseif (str_starts_with($rule, 'max:')) {
                            // OpenAPI has a shared maximum; the description specifies narrower game bounds.
                            $maximum = (int) substr($rule, 4);
                            $this->assertSame($name === 'number' ? 90 : $maximum, $parameter['schema']['maximum']);
                            $this->get(str_replace('{game}', $game, $path).'?'.$name.'='.($maximum + 1))
                                ->assertUnprocessable()->assertJsonValidationErrors($name);
                        } elseif (str_starts_with($rule, 'in:')) {
                            $enum = str_getcsv(substr($rule, 3), escape: '\\');
                            if ($name === 'set') {
                                $this->assertSame($game === 'scandinavian' ? ['machine', 'manual', 'combined'] : ['main'], $enum);
                                $this->assertSame(['main', 'machine', 'manual', 'combined'], $parameter['schema']['enum']);
                            } else {
                                $this->assertSame($enum, $parameter['schema']['enum']);
                            }
                        } elseif ($rule === 'date_format:Y-m-d') {
                            $this->assertSame('date', $parameter['schema']['format']);
                        }
                    }
                }
                $this->assertEqualsCanonicalizing(array_keys($rules), $queries);
            }
        }
    }

    public function test_serialized_responses_match_the_documented_schemas(): void
    {
        foreach (Game::all() as $game) {
            $drawing = $game->drawings()->create(['source_key' => 'contract-'.$game->code, 'year' => 2000, 'week' => 1, 'drawn_on' => null]);
            $types = match ($game->code) {
                'five' => ['main' => 5], 'six' => ['main' => 6, 'bonus' => 1],
                default => ['machine' => 7, 'manual' => 7],
            };
            foreach ($types as $type => $count) {
                $set = $drawing->sets()->create(['type' => $type]);
                $set->numbers()->createMany(array_map(fn (int $n): array => ['number' => $type === 'bonus' ? 7 : $n], range(1, $count)));
            }
            $drawing->prizes()->create(['tier' => 'match_5', 'winner_count' => null, 'amount' => null, 'currency' => null]);
            $drawing->prizes()->create(['tier' => 'match_4', 'winner_count' => 1, 'amount' => '1250000.00', 'currency' => 'HUF']);
            foreach ($this->spec['paths'] as $path => $item) {
                $url = str_replace(['{game}', '{drawing}'], [$game->code, (string) $drawing->id], $path);
                $response = $this->get($url)->assertOk();
                $schema = $item['get']['responses']['200']['content']['application/json']['schema'];
                $this->assertSchema(json_decode($response->getContent(), flags: JSON_THROW_ON_ERROR), $schema);
                if (str_ends_with($path, '/drawings')) {
                    $details = $this->get($url.'?include=details')->assertOk();
                    $this->assertSchema(json_decode($details->getContent(), flags: JSON_THROW_ON_ERROR), $schema);
                    $this->assertSame($this->get($url.'/'.$drawing->id)->json('data'), $details->json('data.0'));
                }
                if (str_ends_with($path, '/trends/yearly')) {
                    $response = $this->get($url.'?number=7')->assertOk();
                    $this->assertSchema(json_decode($response->getContent(), flags: JSON_THROW_ON_ERROR), $schema);
                }
            }
        }
    }

    public function test_documentation_is_available_without_database_queries_and_can_be_disabled(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->get('/api-docs')->assertOk()->assertSee('SwaggerUIBundle', false)
            ->assertSee("supportedSubmitMethods: ['get']", false)->assertHeaderMissing('Set-Cookie');
        $response = $this->get('/api-docs/openapi.json')->assertOk()->assertHeader('Content-Type', 'application/json');
        $this->assertSame($this->spec, json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR));
        $this->assertSame([], DB::getQueryLog());
        DB::disableQueryLog();
        config(['api.docs_enabled' => false]);
        $this->get('/api-docs')->assertNotFound();
        $this->get('/api-docs/openapi.json')->assertNotFound();
    }

    public function test_documented_defaults_match_api_behavior(): void
    {
        $parameters = $this->spec['components']['parameters'];
        foreach (['five' => 90, 'six' => 45, 'scandinavian' => 35] as $game => $range) {
            $base = '/api/v1/games/'.$game;
            $this->get($base.'/drawings')->assertOk()
                ->assertJsonPath('meta.current_page', $parameters['Page']['schema']['default'])
                ->assertJsonPath('meta.per_page', $parameters['PerPage']['schema']['default']);
            $this->get($base.'/statistics/frequencies')->assertOk()
                ->assertJsonPath('meta.sort', $parameters['Sort']['schema']['default'])
                ->assertJsonPath('meta.limit', $range)->assertJsonCount($range, 'data')
                ->assertJsonPath('meta.set_scope', $game === 'scandinavian' ? 'machine' : 'main');
            foreach (['most', 'least'] as $sort) {
                $this->get($base.'/statistics/frequencies?sort='.$sort)->assertOk()
                    ->assertJsonPath('meta.limit', 10)->assertJsonCount(10, 'data');
            }
            $this->get($base.'/statistics/pairs')->assertOk()
                ->assertJsonPath('meta.limit', $parameters['PairLimit']['schema']['default']);
        }
    }

    /**
     * Check only the schema keywords used by this specification; full OpenAPI
     * structural validation is handled by the documented Redocly command.
     *
     * @param  array<string, mixed>  $schema
     */
    private function assertSchema(mixed $value, array $schema): void
    {
        if (isset($schema['$ref'])) {
            $schema = $this->spec['components']['schemas'][basename($schema['$ref'])];
        }
        if ($value === null && ($schema['nullable'] ?? false)) {
            return;
        }
        if (isset($schema['enum'])) {
            $this->assertContains($value, $schema['enum']);
        }
        if (isset($schema['minimum'])) {
            $this->assertGreaterThanOrEqual($schema['minimum'], $value);
        }
        if (isset($schema['maximum'])) {
            $this->assertLessThanOrEqual($schema['maximum'], $value);
        }
        switch ($schema['type']) {
            case 'object':
                $this->assertInstanceOf(\stdClass::class, $value);
                foreach ($schema['required'] ?? [] as $key) {
                    $this->assertObjectHasProperty($key, $value);
                }
                foreach (get_object_vars($value) as $key => $child) {
                    $this->assertArrayHasKey($key, $schema['properties']);
                    $this->assertSchema($child, $schema['properties'][$key]);
                }
                break;
            case 'array':
                $this->assertIsArray($value);
                foreach ($value as $child) {
                    $this->assertSchema($child, $schema['items']);
                }
                break;
            case 'integer':
                $this->assertIsInt($value);
                break;
            case 'number':
                $this->assertTrue(is_int($value) || is_float($value));
                break;
            case 'boolean':
                $this->assertIsBool($value);
                break;
            case 'string':
                $this->assertIsString($value);
                if (isset($schema['pattern'])) {
                    $this->assertMatchesRegularExpression('/'.$schema['pattern'].'/', $value);
                }
                break;
            default:
                $this->fail('Unsupported specification schema type.');
        }
    }
}
