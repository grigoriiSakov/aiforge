# go-service

Designed for Go services that follow the standard Go toolchain.

Default assumptions:

- `go test ./...`
- `test -z "$(gofmt -l .)"`
- `go vet ./...`

Use this profile for services with `cmd/`, `internal/`, or small package-oriented layouts.
