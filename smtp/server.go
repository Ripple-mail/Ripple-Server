package smtp

import (
	"bufio"
	"fmt"
	"net"
	"strings"
	"sync/atomic"
)

var (
	activeConnections int32
	totalConnections  int32
)

func StartSMTPServer() error {
	listener, err := net.Listen("tcp", ":2525")
	if err != nil {
		return err
	}
	defer listener.Close()

	fmt.Println("SMTP server listening on port 2525")

	for {
		conn, err := listener.Accept()
		if err != nil {
			continue
		}
		atomic.AddInt32(&totalConnections, 1)
		atomic.AddInt32(&activeConnections, 1)

		go handleConnection(conn)
	}
}

func handleConnection(conn net.Conn) {
	defer conn.Close()
	defer atomic.AddInt32(&activeConnections, -1)

	session := NewSMTPSession(conn)
	conn.Write([]byte("220 Ripple mail\r\n"))
	reader := bufio.NewReader(conn)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			fmt.Println("Connection closed:", err)
			return
		}

		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			continue
		}

		if session.CollectingData {
			if line == "." {
				session.CollectingData = false
				err := SaveEmail(session.RcptTo, session.GetFullMessage())
				if err != nil {
					conn.Write([]byte("451 Request action aborted: local error in processing\r\n"))
				} else {
					conn.Write([]byte("250 OK message accepted\r\n"))
				}
				session.Reset()
			} else {
				session.DataLines = append(session.DataLines, line)
			}
		} else {
			HandleCommand(session, line)
		}
	}
}
