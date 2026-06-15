FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY shared/ ./shared/
COPY services/notif-svc/ ./services/notif-svc/
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
RUN cd services/notif-svc && go mod download && go build -o /notif-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /notif-svc-bin /notif-svc
COPY services/notif-svc/migrations/ /migrations/
EXPOSE 8089
CMD ["/notif-svc"]
