FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/inventori-svc/ ./services/inventori-svc/
RUN cd services/inventori-svc && go mod download && go build -o /inventori-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /inventori-svc-bin /inventori-svc
COPY services/inventori-svc/migrations/ /migrations/
EXPOSE 8085
CMD ["/inventori-svc"]
