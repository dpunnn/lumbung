FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/marketplace-svc/ ./services/marketplace-svc/
RUN cd services/marketplace-svc && go mod download && go build -o /marketplace-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /marketplace-svc-bin /marketplace-svc
COPY services/marketplace-svc/migrations/ /migrations/
EXPOSE 8088
CMD ["/marketplace-svc"]
