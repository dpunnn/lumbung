FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/simpanpinjam-svc/ ./services/simpanpinjam-svc/
RUN cd services/simpanpinjam-svc && go mod download && go build -o /simpanpinjam-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /simpanpinjam-svc-bin /simpanpinjam-svc
COPY services/simpanpinjam-svc/migrations/ /migrations/
EXPOSE 8084
CMD ["/simpanpinjam-svc"]
