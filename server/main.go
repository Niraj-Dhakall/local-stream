package main

import (
	"encoding/json"
	"errors"
	"log/slog"
	"math/rand"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

var (
	charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	rng     = rand.New(rand.NewSource(time.Now().UnixNano()))
)

type SafeConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

type Room struct {
	mu         sync.RWMutex
	code       string
	streamer   *SafeConn
	viewers    map[string]*SafeConn
	closeChan  chan struct{}
	emptyTimer *time.Timer
}

var (
	roomsMu sync.RWMutex
	rooms   = make(map[string]*Room)
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ========================== Helpers ==================================
// instead of just writing message like before with a single conection we
// will do this now
func (sc *SafeConn) WriteJSON(msg []byte) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	if sc.conn == nil {
		return nil
	}
	return sc.conn.WriteMessage(websocket.TextMessage, msg)
}

func (room *Room) startEmptyTimer() {
	if room.emptyTimer != nil {
		room.emptyTimer.Stop()
	}

	room.emptyTimer = time.AfterFunc(5*time.Minute, func() {
		room.mu.RLock()
		var empty bool
		empty = len(room.viewers) == 0 && room.streamer == nil
		room.mu.RUnlock()

		if empty {
			deleteRoom(room.code)
		}
	})
}

func checkCode(roomCode string) bool {
	var alphanumeric = regexp.MustCompile("^[a-zA-Z0-9]+$")
	return alphanumeric.MatchString(roomCode)

}

func broadCastViewerCount(room *Room) {
	count := len(room.viewers)
	msg, _ := json.Marshal(map[string]interface{}{"type": "viewer-count", "count": count})
	// no mutex stuff since it will be handled in the main join/leave function
	if room.streamer != nil {
		room.streamer.WriteJSON(msg)
	}
	for _, v := range room.viewers {
		v.WriteJSON(msg)
	}
}

// ========================== Room ==================================

/*
Finds a room for a given code
In: code -> string | *Room code ex: /api/join?room='abcd'
Out: Room -> Room pointer | *Pointer to a new room that was found
*/
func findRoom(code string) *Room {
	roomsMu.RLock() // rlock and unlock since we are only reading not writing
	defer roomsMu.RUnlock()
	room, ok := rooms[code]
	if !ok {
		slog.Info("Room not found", "code", code)
		return nil

	}
	return room
}

/*
Create a new room with a given code
In: code -> string | *Room code
Out: Room -> Room pointer | *Pointer to a new room that was created
*/
func createRoom(code string) *Room {
	roomsMu.Lock()
	defer roomsMu.Unlock()
	room := &Room{code: code, viewers: make(map[string]*SafeConn)}
	rooms[code] = room
	room.startEmptyTimer()
	return room

}
func deleteRoom(code string) error {
	roomsMu.Lock()
	delete(rooms, code)
	roomsMu.Unlock()
	exists := findRoom(code)
	if exists == nil {
		return nil
	}
	return errors.New("Room not deleted")
}

// Generate a string for a given room
func getCode() string {
	for {
		var sb strings.Builder
		sb.Grow(6)

		for i := 0; i < 6; i++ {
			sb.WriteByte(charset[rng.Intn(len(charset))])
		}

		code := sb.String()

		roomsMu.Lock()
		_, exists := rooms[code]
		roomsMu.Unlock()

		if !exists {
			return code
		}
	}
}

// ========================== Streamer ==================================

/*
If the connection is a streamer and they enter a room two scenerios can happen:
Room exists: in this case, return the room
Room doesn't exist: create a room, and return a pointer to it
*/
func getOrCreateRoomSteamer(code string) (*Room, error) {
	roomsMu.Lock()
	defer roomsMu.Unlock()

	room, exists := rooms[code]
	if !exists {
		room = &Room{
			code:    code,
			viewers: make(map[string]*SafeConn),
		}
		rooms[code] = room
	}
	return room, nil
}

// remove streamer from room and inform viewers
func removeStreamer(room *Room) {
	room.mu.Lock()
	room.streamer = nil
	closeCh := make(chan struct{}) // create a channel to send signal
	room.closeChan = closeCh
	viewers := make([]*SafeConn, 0, len(room.viewers))
	for _, v := range room.viewers {
		viewers = append(viewers, v)
	}
	room.startEmptyTimer()
	room.mu.Unlock()

	msg, err := json.Marshal(map[string]string{"type": "viewer-message", "message": "Streamer has left, room will be closed in 30 seconds."})
	if err != nil {
		slog.Error("removeStreamer", "error", err)
	}
	broadcastToViewers(viewers, msg)

	select {
	case <-closeCh: // if we get a signal then the streamer reconnected
		slog.Info("removeStreamer", "event","streamer reconnected", "room", room.code)
	case <-time.After(30 * time.Second):
		slog.Info("removeStreamer", "event","room closure timeout", "room", room.code)
		deleteRoom(room.code)
	}
}

// add a streamer to a given room
func joinAsStreamer(room *Room, sc *SafeConn) error {
	room.mu.Lock()

	if room.streamer != nil {
		room.mu.Unlock()
		slog.Info("joinAsStreamer", "event", "streamer already connected", "room", room.code)
		msg, err := json.Marshal(map[string]string{"type": "streamer-message", "message": "Streamer already connected in this room."})
		if err != nil {
			slog.Error("joinAsStreamer", "Marshalling error", err)
		}
		sc.WriteJSON(msg)
		return errors.New("streamer already connected")
	}
	room.streamer = sc
	if room.emptyTimer != nil {
		room.emptyTimer.Stop()
		room.emptyTimer = nil
	}
	// reconnection logic
	closeCh := room.closeChan
	room.closeChan = nil

	viewers := make([]*SafeConn, 0, len(room.viewers))
	for _, v := range room.viewers {
		viewers = append(viewers, v)
	}

	room.mu.Unlock()

	if closeCh != nil { // if there already was a disconnect channel, close it and send the signal
		close(closeCh)
	}

	if closeCh != nil && len(viewers) > 0 { // if the channel did exist and there are viewers it means that the streamer is reconnecting
		msg, err := json.Marshal(map[string]string{"type": "streamer-reconnected", "message": "Streamer has reconnected."})
		if err != nil {
			slog.Error("joinAsStreamer", "Marshalling error", err)
		}
		broadcastToViewers(viewers, msg)
	}

	// for early viewers to the stream, because frontend needs new-viewer to create a new connection
	room.mu.RLock()
	for id := range room.viewers {
		msg, err := json.Marshal(map[string]string{"type": "new-viewer", "viewerID": id})
		if err != nil {
			slog.Error("joinAsStreamer", "Marshalling error", err)
		}
		sc.WriteJSON(msg)
	}
	room.mu.RUnlock()

	return nil
}

// ========================== Viewer ==================================
// for broadcasting to all viewers in a given room
func broadcastToViewers(viewers []*SafeConn, message []byte) {
	for _, viewer := range viewers {
		go func(v *SafeConn) {
			err := v.WriteJSON(message)
			if err != nil {
				slog.Error("Write error", "error", err)

			}
		}(viewer)
	}
}

// remove viewer from room
func removeViewer(room *Room, id string) {
	room.mu.Lock()
	defer room.mu.Unlock()
	delete(room.viewers, id)
	slog.Info("Viewer left", "viewerID", id)
	msg, err := json.Marshal(map[string]string{"type": "viewer-left", "viewerID": id})
	if err != nil{
			slog.Error("removeStreamer", "Marshalling error", err)
		}
	if room.streamer != nil {
		room.streamer.WriteJSON(msg)
	}
	empty := len(room.viewers) == 0
	if empty {
		room.startEmptyTimer()
	}
	broadCastViewerCount(room)

}

/*
A viewer doesn't create a room so if they try to join a room that doesn't exist, then they can't join it
*/
func getRoomForViewer(code string) (*Room, error) {
	roomsMu.RLock()
	defer roomsMu.RUnlock()

	room, exists := rooms[code]
	if !exists {
		return nil, errors.New("room not found")
	}

	return room, nil
}

// helper function for finding a viewer in a room
func findViewer(id string, room *Room) (*SafeConn, error) {
	room.mu.RLock()
	defer room.mu.RUnlock()
	viewer, exists := room.viewers[id]
	if !exists {
		return nil, errors.New("viewer not in room")
	}

	return viewer, nil
}

func joinAsViewer(room *Room, sc *SafeConn, id string) error {
	room.mu.Lock()
	defer room.mu.Unlock()

	if room.viewers == nil {
		room.viewers = make(map[string]*SafeConn)
	}

	_, exists := room.viewers[id]

	if exists {
		return errors.New("viewer already exists")
	}
	room.viewers[id] = sc
	msg, err := json.Marshal(map[string]string{"type": "new-viewer", "viewerID": id})
	if err != nil{
			slog.Error("joinAsViewer", "Marshalling error", err)
		}
	if room.streamer != nil {
		room.streamer.WriteJSON(msg)
	}
	if room.emptyTimer != nil {
		room.emptyTimer.Stop()
		room.emptyTimer = nil
	}
	broadCastViewerCount(room)
	return nil
}

// function that is called when the /api/room endpoint is called
func handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	code := getCode()
	room := createRoom(code)
	if room != nil {
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(room.code)
		return

	}
}

// function for handling websocket request
func handleWebSockets(w http.ResponseWriter, r *http.Request) {
	slog.Info("handleWebSocketConnection","Info","new request arrived")
	// get role from query (viewer or streamer)
	role := r.URL.Query().Get("role")
	if role != "streamer" && role != "viewer" {
		slog.Warn("Invalid role", "role", role)
		return
	}
	var viewerID string
	if role == "viewer" {
		viewerID = r.URL.Query().Get("viewerID")
		if viewerID == "" {
			w.WriteHeader(http.StatusBadRequest)
			response := Response{Status: "error", Message: "No viewer id provided"}
			json.NewEncoder(w).Encode(response)
			return
		}
	}

	urlRoom := r.URL.Query().Get("room")

	if urlRoom == "" {
		w.WriteHeader(http.StatusNotFound)
		response := Response{Status: "error", Message: "No room provided"}
		json.NewEncoder(w).Encode(response)
		return
	}

	if len(urlRoom) != 6 || !checkCode(urlRoom) {
		w.WriteHeader(http.StatusBadRequest)
		response := Response{Status: "error", Message: "Code is wrong length or formatted wrong"}
		json.NewEncoder(w).Encode(response)
		return
	}

	// updgrade the http request to websocker
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("Upgrade error", "error", err)
		return
	}

	defer func() {
		err := conn.Close()
		if err != nil {
			slog.Error("Connection close error", "error", err)
		}
	}()

	slog.Info("New connection", "role", role)
	sc := SafeConn{
		conn: conn,
	}

	// if the role is streamer, then we need to check if the room exists, if it doesn't exist, then we create a new room and add the streamer to it
	// if the role is viewer, then we need to check if the room exists, if it doesn't exist, then we return an error, if it does exist, then we add the viewer to the room
	var room *Room
	switch role {
	case "streamer":
		room, err = getOrCreateRoomSteamer(urlRoom)
		if err != nil {
			return
		}
		err = joinAsStreamer(room, &sc)
		if err != nil {
			msg, _ := json.Marshal(map[string]string{"type": "error", "message": "Room already has a streamer"})
			sc.WriteJSON(msg)
			return
		}
		defer func() {
			removeStreamer(room)
		}()
	case "viewer":
		room, err = getRoomForViewer(urlRoom)
		if err != nil {
			return
		}
		joinAsViewer(room, &sc, viewerID)
		slog.Info("Viewer joined", "viewerID", viewerID)
		defer func() {
			removeViewer(room, viewerID)
		}()
	}
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			slog.Warn("Read error", "error", err)
			break
		}
		// if it's a streamer we need to write it's message to the viewer
		if role == "streamer" {
			var streamerVID struct {
				ViewerID string `json:"viewerID"`
			}
			err = json.Unmarshal(message, &streamerVID)
			if err != nil {
				slog.Warn("Error unmarshalling streamer message", "error", err)
				continue
			}
			viewer, err := findViewer(streamerVID.ViewerID, room)
			if err == nil {
				viewer.WriteJSON(message)
			} else {
				slog.Warn("Error finding viewer", "error", err)
			}
		}
		// viewer is more complicated, since we want to track users joining and leaving so
		// we must inject the viewerID and send it to the streamer in the room
		if role == "viewer" {
			// inject viewer id in to the message
			var msg map[string]interface{} // interface since we don't know the fields
			if err := json.Unmarshal(message, &msg); err != nil {
				slog.Warn("Error unmarshalling viewer message","error", err)
				continue
			}
			msg["viewerID"] = viewerID
			updatedMsg, _ := json.Marshal(msg)
			room.mu.Lock()
			streamer := room.streamer
			room.mu.Unlock()
			if streamer != nil {
				streamer.WriteJSON(updatedMsg)
			}
		}

	}

}

func handleRoomStreamerCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	urlRoom := r.URL.Query().Get("room")
	if urlRoom == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Status: "error", Message: "Room code is required"})
		return
	}

	room := findRoom(urlRoom)
	if room == nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Status: "error", Message: "Room not found"})
		return
	}

	room.mu.RLock()
	hasStreamer := room.streamer != nil
	room.mu.RUnlock()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "success",
		"hasStreamer": hasStreamer,
		"roomCode":    room.code,
	})
}

func handleViewerRoomCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	urlRoom := r.URL.Query().Get("room")
	if urlRoom == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Status: "error", Message: "Room code is required"})
		return
	}

	room := findRoom(urlRoom)
	exists := room != nil
	if room == nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "fail",
			"exists": exists,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "success",
		"exists":   exists,
		"roomCode": room.code,
	})
}
func handleRoomDelete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	urlRoom := r.URL.Query().Get("room")
	if urlRoom == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Status: "error", Message: "Room code is required"})
		return
	}
	err := deleteRoom(urlRoom)
	if err == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
		})
		return
	}
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "fail",
	})

}
func main() {
	http.HandleFunc("/ws", handleWebSockets)
	http.HandleFunc("/api/rooms", handleCreateRoom) // create a room
	http.HandleFunc("/api/rooms/del", handleRoomDelete) // delete a room
	http.HandleFunc("/api/rooms/viewer", handleViewerRoomCheck) // checks if a room is still active
	http.HandleFunc("/api/rooms/streamer", handleRoomStreamerCheck) // checks if a room has a streamer (for protection against someone overriding stream)
	slog.Info("Server starting", "port", ":8080")
	err := http.ListenAndServeTLS(":8080", "cert.pem", "key.pem", nil)
	if err != nil {
		slog.Error("Server failed", "error", err)
	}
}
