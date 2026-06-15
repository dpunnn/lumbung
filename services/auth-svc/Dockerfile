FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/auth-svc/ ./services/auth-svc/
RUN cd services/auth-svc && go mod download && go build -o /auth-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /auth-svc-bin /auth-svc
COPY services/auth-svc/migrations/ /migrations/
EXPOSE 8081
CMD ["/auth-svc"]
