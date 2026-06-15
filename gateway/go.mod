module github.com/lumbung/gateway

go 1.23

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/lumbung/shared v0.0.0
	github.com/redis/go-redis/v9 v9.7.0
)

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
)

replace github.com/lumbung/shared => ../shared
