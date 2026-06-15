FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/pass-svc/ ./services/pass-svc/
RUN cd services/pass-svc && go mod download && go build -o /pass-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /pass-svc-bin /pass-svc
COPY services/pass-svc/migrations/ /migrations/
EXPOSE 8086
CMD ["/pass-svc"]
