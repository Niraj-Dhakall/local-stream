package main

import ( "testing")

var code = "ABCDEF"
func TestRoomCycle(t *testing.T){
	
	room := createRoom(code)
	if room == nil{
		t.Error("Room was not created")
		return
	}

	found := findRoom(code)
	if found == nil{
		t.Error("Room was not found after creation")
		return
	}

	deleteRoom(code)
	found = findRoom(code)
	if found != nil {
		t.Error("Room was not deleted")
		return
	}
}

func TestDupeStreamer(t *testing.T){
	room := createRoom(code)

	connection := SafeConn{}
	err := joinAsStreamer(room, &connection)
	if err != nil{
		t.Errorf("Error when streamer is joining %v", err)
		return
	}
	connection2 := SafeConn{}
	err = joinAsStreamer(room, &connection2)
	if err == nil{
		t.Errorf("A second streamer could join")
		return
	}
	deleteRoom(code)

}

func TestDeletingNullRoom(t *testing.T){
	err := deleteRoom("ABCDE")
	if err != nil{
		t.Errorf("Error when deleting null room %v", err)
		return
	}
}
func TestViewerCycle(t *testing.T){
	room := createRoom(code)

	connection := SafeConn{}
	err := joinAsViewer(room, &connection, "Viewer1")
	if err != nil {
		t.Errorf("Error when viewer joining: %v", err)
		return
	}

	room.mu.RLock()
	viewers := len(room.viewers)
	room.mu.RUnlock()

	if viewers != 1{
		t.Errorf("Viewer count is not 1: %v", viewers)
		return;
	}

	err = joinAsViewer(room, &connection, "Viewer1")
	if err == nil{
		t.Errorf("Viewer joined twice")
		return;
	}
	removeViewer(room, "Viewer1")

	room.mu.RLock()
	viewers = len(room.viewers)
	room.mu.RUnlock()

	if viewers != 0{
		t.Error("Viewer count did not become 0")
		return;
	}

}