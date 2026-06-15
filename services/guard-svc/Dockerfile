FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/guard-svc/ ./services/guard-svc/
RUN cd services/guard-svc && go mod download && go build -o /guard-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /guard-svc-bin /guard-svc
COPY services/guard-svc/migrations/ /migrations/
EXPOSE 8087
CMD ["/guard-svc"]
