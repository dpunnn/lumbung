FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
# go.work tidak dipakai di dalam build kontainer (modul lain tidak di-copy).
# Modul gateway memakai directive `replace github.com/lumbung/shared => ../shared`.
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY gateway/ ./gateway/
RUN cd gateway && go mod download && go build -o /gateway-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /gateway-bin /gateway
EXPOSE 8080
CMD ["/gateway"]
