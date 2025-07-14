package socket

import (
	"log"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

var (
	connections = make(map[*websocket.Conn]bool)
	rooms       = make(map[string]map[*websocket.Conn]bool)
	mu          sync.Mutex
)

func WebSocketHandler(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		c.Locals("allowed", true)
		return c.Next()
	}
	return fiber.ErrUpgradeRequired
}

func WebSocketEndpoint(c *websocket.Conn) {
	mu.Lock()
	connections[c] = true
	mu.Unlock()
	defer func() {
		mu.Lock()
		delete(connections, c)
		// Remove from all rooms
		for _, conns := range rooms {
			delete(conns, c)
		}
		mu.Unlock()
		c.Close()
	}()

	log.Printf("[WebSocket] New client connected")

	for {
		var msg map[string]interface{}
		if err := c.ReadJSON(&msg); err != nil {
			log.Printf("[WebSocket] Read error: %v", err)
			break
		}

		if event, ok := msg["event"].(string); ok {
			switch event {
			case "ping":
				c.WriteJSON(map[string]string{"event": "pong"})
			case "joinRoom":
				if room, ok := msg["room"].(string); ok {
					joinRoom(c, room)
					log.Printf("[WebSocket] Socket joined room: %s", room)
				}
			default:
				log.Printf("[WebSocket] Unknown event: %s", event)
			}
		}
	}

	log.Printf("[WebSocket] Client disconnected")
}

func joinRoom(c *websocket.Conn, room string) {
	mu.Lock()
	defer mu.Unlock()
	if rooms[room] == nil {
		rooms[room] = make(map[*websocket.Conn]bool)
	}
	rooms[room][c] = true
}

func SendToRoom(room string, event string, data interface{}) {
	mu.Lock()
	defer mu.Unlock()
	for conn := range rooms[room] {
		err := conn.WriteJSON(map[string]interface{}{
			"event": event,
			"data":  data,
		})
		if err != nil {
			log.Printf("[WebSocket] Write error: %v", err)
			conn.Close()
			delete(rooms[room], conn)
			delete(connections, conn)
		}
	}
}
