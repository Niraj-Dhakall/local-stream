package main

import (
	"encoding/json"
	"errors"
	"log"
	"math/rand"
	"net/http"
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
	mu       sync.RWMutex
	code     string
	streamer *SafeConn
	viewers  map[string]*SafeConn
	closeChan chan struct{}
}

var (
	roomsMu sync.RWMutex
	rooms   = make(map[string]*Room)
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// instead of just writing message like before with a single conection we
// will do this now
func (sc *SafeConn) WriteJSON(msg []byte) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	return sc.conn.WriteMessage(websocket.TextMessage, msg)
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
		log.Println("Error finding room")

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
	
	return room

}
func deleteRoom(code string) error{
	roomsMu.Lock()
	delete(rooms, code)
	roomsMu.Unlock()
	exists := findRoom(code)
	if(exists == nil){
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
	closeCh := make(chan struct{})
	room.closeChan = closeCh
	viewers := make([]*SafeConn, 0, len(room.viewers))
	for _, v := range room.viewers {
		viewers = append(viewers, v)
	}
	room.mu.Unlock()

	msg, _ := json.Marshal(map[string]string{"type": "viewer-message", "message": "Streamer has left, room will be closed in 30 seconds."})
	broadcastToViewers(viewers, msg)

	select {
	case <-closeCh:
		log.Println("Streamer reconnected, cancelling room closure for:", room.code)
	case <-time.After(30 * time.Second):
		log.Println("Room closure timeout reached for:", room.code)
	}
}

// add a streamer to a given room
func joinAsStreamer(room *Room, sc *SafeConn) error {
	room.mu.Lock()

	if room.streamer != nil {
		room.mu.Unlock()
		log.Print("Streamer already connected in: ", room.code)
		msg, _ := json.Marshal(map[string]string{"type": "streamer-message", "message": "Streamer already connected in this room."})
		sc.WriteJSON(msg)
		return errors.New("streamer already connected")
	}

	room.streamer = sc

	// cancel pending room closure if any
	closeCh := room.closeChan
	room.closeChan = nil

	// collect viewers to notify
	viewers := make([]*SafeConn, 0, len(room.viewers))
	for _, v := range room.viewers {
		viewers = append(viewers, v)
	}
	room.mu.Unlock()

	if closeCh != nil {
		close(closeCh)
	}

	if len(viewers) > 0 {
		msg, _ := json.Marshal(map[string]string{"type": "streamer-reconnected", "message": "Streamer has reconnected."})
		broadcastToViewers(viewers, msg)
	}

	return nil
}

// ========================== Viewer ==================================
// for broadcasting to all viewers in a given room
func broadcastToViewers(viewers []*SafeConn, message []byte) {
	for _, viewer := range viewers {
		go func(v *SafeConn) {
			err := v.WriteJSON(message)
			if err != nil {
				log.Println("Write error", err)

			}
		}(viewer)
	}
}

// remove viewer from room
func removeViewer(room *Room, id string) {
	room.mu.Lock()
	defer room.mu.Unlock()
	delete(room.viewers, id)
	log.Print("Viewer left: ", id)
	msg, _ := json.Marshal(map[string]string{"type": "viewer-left", "viewerID": id})
	if room.streamer != nil {
		room.streamer.WriteJSON(msg)
	}

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
	msg, _ := json.Marshal(map[string]string{"type": "new-viewer", "viewerID": id})
	if room.streamer != nil {
		room.streamer.WriteJSON(msg)
	}
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
	log.Println("new request arrived")
	// get role from query (viewer or streamer)
	role := r.URL.Query().Get("role")
	if role != "streamer" && role != "viewer" {
		log.Println("Invalid role:", role)
		return
	}
	var viewerID string
	if role == "viewer" {
		viewerID = r.URL.Query().Get("viewerID")
	}
	urlRoom := r.URL.Query().Get("room")

	if urlRoom == "" {
		w.WriteHeader(http.StatusNotFound)
		response := Response{Status: "error", Message: "No room provided"}
		json.NewEncoder(w).Encode(response)
		return
	}

	// updgrade the http request to websocker
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	defer func() {
		err := conn.Close()
		if err != nil {
			log.Println("Close error:", err)
		}
	}()

	log.Println("New connection with role:", role)
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
		log.Print("Viewer joined with ID:", viewerID)
		defer func() {
			removeViewer(room, viewerID)
		}()
	}
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			break
		}
		// if it's a streamer we need to write it's message to the viewer
		if role == "streamer" {
			var streamerVID struct {
				ViewerID string `json:"viewerID"`
			}
			json.Unmarshal(message, &streamerVID)
			viewer, err := findViewer(streamerVID.ViewerID, room)
			if err == nil {
				viewer.WriteJSON(message)
			} else {
				log.Println("Error finding viewer:", err)
			}
		}
		// viewer is more complicated, since we want to track users joining and leaving so
		// we must inject the viewerID and send it to the streamer in the room
		if role == "viewer" {
			// inject viewer id in to the message
			var msg map[string]interface{} // interface since we don't know the fields
			json.Unmarshal(message, &msg)
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

func handleRoomStreamerCheck(w http.ResponseWriter, r *http.Request){
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
		"status": "success",
		"hasStreamer": hasStreamer,
		"roomCode": room.code,
	})
}

func handleViewerRoomCheck(w http.ResponseWriter, r *http.Request){
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
		"status": "success",
		"exists": exists,
		"roomCode": room.code,
	})
}
func handleRoomDelete(w http.ResponseWriter, r *http.Request){
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
	err := deleteRoom(urlRoom);
	if(err != nil){
		w.WriteHeader(http.StatusNotFound)
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
	http.HandleFunc("/api/rooms", handleCreateRoom)
	http.HandleFunc("/api/rooms/del", handleRoomDelete)
	http.HandleFunc("/api/rooms/viewer", handleViewerRoomCheck)
	http.HandleFunc("/api/rooms/streamer", handleRoomStreamerCheck)
	log.Println("Signaling server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
