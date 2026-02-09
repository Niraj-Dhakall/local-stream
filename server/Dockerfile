FROM golang:1.24.1 AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server

FROM ubuntu:latest
WORKDIR /app

COPY --from=build /app/server .
EXPOSE 8080
CMD ["./server"]