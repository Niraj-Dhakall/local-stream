# LocalStream
A real time screen sharing web app built from scratch with WebRTC and WebSockets. Does not use any third party streaming services, or the cloud, just p2p video over the local network.

A streamer can capture their screen and broad cast it to a room. Viewers can join with a 6 chararacter code and can view the stream through WebRTC. The Go server is a signaling server that helps establish the connections.

## Why I built this

I wanted to learn something new. I've had experience with http calls and REST APIs but not with WebSockets or WebRTC. Before building this I did not even know what happens on apps such as Discord when you share your screen. 

I started with 1 streamer 1 viewer as a way to build my knowledge and after that turned it into what it is now.

### Challenges:
* The biggest challenge was starting it. I had no clue about anything. About signaling, ICE candidates, Offers/Answers. But that is the reason I started, was to learn. 

* Another challenge was dealing with multiple viewers. Scaling from 1-to-1 to 1-to-many streaming required me to redeign the Go backend to handle multiple viewers and dealing with concurrency in the rooms and the viewers lists.

## Architecture

![Architecture](https://i.imgur.com/WTZJymx.png)

## WebSocket Protocol Flow
1. Handshake: Client upgrades HTTP to WS with room code and role params
2. Signaling: Streamer generates a WebRTC offer, Go signal server broadscasts to the viewer(s) in the room.
3. ICE Negotiation: Peers exchange network candidates through the Go server.
4. Heartbeat: Server manages connections. If streamer disconnects room gets deleted in 30 seconds, reconnection stops the countdown.
Go - Backend

All the code for the Go server is in main.go, this file handles:

* Room management: Rooms are map structures and all operations are thread safe through the use of RWMutex, and Mutex for each connection.
* Connection upgrade: HTTP requests are upgraded to WS and each connection is wrapped in a SafeConn wrapper to allow for mutual exclusion lock.
* Streamer management: Manages streamers for a given room and also handles streamer drops and reconnects.
* Automatic room clean up: Empty rooms after 5 minutes are deleted through server-side operations.
* REST API: For deleting rooms, and checks for rooms and streamer.
* Logging: Logs all errors and information.

* main_test.go: test file to make sure main.go is functional.


Next.js + React - Frontend

* StreamerView: All logic for the streamer. Captures screen using getDisplayMedia() function, creates one RTCPeerConnection per viewer.
* ViewerView: Displays the stream, recieves offers and sends answers.
* useWebSocketConnection: Hook for establishing a WebSocket connection to a server. Handles open, close, error, and message events. Has a 3 attempt reconnection logic. 
* useRoomHealthCheck: Polls the server every 10 seconds to makre sure a room is active. If room is not active, triggers a modal to let the viewers and streamer know.

## Decisions and Tradeoffs

* STUN vs TURN server: Since this was supposed to be a "local" project I did not think paying for a TURN server was a good idea. I just needed a way for the clients to discorver their public IP to establish a connection. If I decide to make this work outside the NAT, I will consider switching. 

* Why WebSocket and WebRTC: I needed a Bi-directional channel for signaling and I also wanted to work with WebSockets. WebRTC for media sharing.

* One peer connection per viewer: Since this was an introduction project I wanted it to be basic. For a handful of viewers locally it is a good decision, though a burdon on the streamer's hardware. 

## Getting Started
### Prerequisites:
* Go 1.21+
* Node.js 18+
* npm

## Docker Deployment
I recommend depolying it using docker
```bash
docker-compose up -d --build 

or

docker compose up -d --build
```

Manual setup
1. Start backend
```bash
cd server
go mod download
go run main.go # running on localhost:8080
```

2. Start frontend
```bash
cd web
npm install
npm run dev # running on localhost:3000
```