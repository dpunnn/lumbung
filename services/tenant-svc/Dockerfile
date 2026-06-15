FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/tenant-svc/ ./services/tenant-svc/
RUN cd services/tenant-svc && go mod download && go build -o /tenant-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /tenant-svc-bin /tenant-svc
COPY services/tenant-svc/migrations/ /migrations/
EXPOSE 8082
CMD ["/tenant-svc"]
