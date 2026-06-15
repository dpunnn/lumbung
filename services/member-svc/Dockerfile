FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
ENV GOWORK=off
ENV GOPROXY=https://goproxy.io,direct
ENV GONOSUMDB=*
COPY shared/ ./shared/
COPY services/member-svc/ ./services/member-svc/
RUN cd services/member-svc && go mod download && go build -o /member-svc-bin ./cmd/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /
COPY --from=builder /member-svc-bin /member-svc
COPY services/member-svc/migrations/ /migrations/
EXPOSE 8083
CMD ["/member-svc"]
